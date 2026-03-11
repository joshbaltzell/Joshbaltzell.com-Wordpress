<?php
/**
 * REST API endpoints for JB AI Interviewer.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class JBAI_REST_API {

	const NAMESPACE = 'jb-interviewer/v1';

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register REST routes.
	 */
	public function register_routes() {
		register_rest_route( self::NAMESPACE, '/chat', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_chat' ),
			'permission_callback' => array( $this, 'check_permission' ),
			'args'                => array(
				'post_id'  => array( 'required' => true, 'type' => 'integer', 'sanitize_callback' => 'absint' ),
				'message'  => array( 'type' => 'string', 'default' => '', 'sanitize_callback' => 'sanitize_textarea_field' ),
				'subject'  => array( 'type' => 'string', 'default' => '', 'sanitize_callback' => 'sanitize_text_field' ),
				'angle'    => array( 'type' => 'string', 'default' => '', 'sanitize_callback' => 'sanitize_text_field' ),
				'audience' => array( 'type' => 'string', 'default' => '', 'sanitize_callback' => 'sanitize_text_field' ),
			),
		) );

		register_rest_route( self::NAMESPACE, '/format', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_format' ),
			'permission_callback' => array( $this, 'check_permission' ),
			'args'                => array(
				'post_id' => array( 'required' => true, 'type' => 'integer', 'sanitize_callback' => 'absint' ),
			),
		) );

		register_rest_route( self::NAMESPACE, '/complete', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_complete' ),
			'permission_callback' => array( $this, 'check_permission' ),
			'args'                => array(
				'post_id' => array( 'required' => true, 'type' => 'integer', 'sanitize_callback' => 'absint' ),
			),
		) );

		register_rest_route( self::NAMESPACE, '/reset', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_reset' ),
			'permission_callback' => array( $this, 'check_permission' ),
			'args'                => array(
				'post_id' => array( 'required' => true, 'type' => 'integer', 'sanitize_callback' => 'absint' ),
			),
		) );
	}

	/**
	 * Permission check — user must be able to edit posts.
	 */
	public function check_permission( $request ) {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Handle chat endpoint — send/receive messages with OpenAI.
	 */
	public function handle_chat( $request ) {
		$post_id  = $request->get_param( 'post_id' );
		$message  = $request->get_param( 'message' );
		$subject  = $request->get_param( 'subject' );
		$angle    = $request->get_param( 'angle' );
		$audience = $request->get_param( 'audience' );

		$api_key = get_option( 'jbai_api_key', '' );
		if ( empty( $api_key ) ) {
			return new WP_Error( 'no_api_key', 'OpenAI API key not configured. Go to Settings > JB AI Interviewer.', array( 'status' => 400 ) );
		}

		// Load existing conversation or start fresh.
		$conversation = $this->get_conversation( $post_id );
		$is_start     = empty( $conversation );

		if ( $is_start ) {
			// Build system prompt with topic details.
			$system_prompt = get_option( 'jbai_system_prompt', jbai_default_system_prompt() );
			$system_prompt = str_replace(
				array( '{SUBJECT}', '{ANGLE}', '{AUDIENCE}' ),
				array( $subject, $angle, $audience ),
				$system_prompt
			);

			$conversation = array(
				array( 'role' => 'system', 'content' => $system_prompt ),
			);

			// Store interview metadata.
			update_post_meta( $post_id, '_jbai_interview_subject', $subject );
			update_post_meta( $post_id, '_jbai_interview_angle', $angle );
			update_post_meta( $post_id, '_jbai_interview_audience', $audience );
		} else {
			// Append user's answer.
			if ( ! empty( $message ) ) {
				$conversation[] = array( 'role' => 'user', 'content' => $message );
			}
		}

		// Count rounds (each user message = 1 round).
		$round = 0;
		foreach ( $conversation as $msg ) {
			if ( 'user' === $msg['role'] ) {
				$round++;
			}
		}

		// After round 8, add a wrap-up hint to help the AI converge.
		$messages_for_api = $conversation;
		if ( $round >= 8 ) {
			$messages_for_api[] = array(
				'role'    => 'system',
				'content' => sprintf(
					'You have completed %d rounds. Begin naturally wrapping up the interview within the next 1-2 questions. Make your next question forward-looking or reflective.',
					$round
				),
			);
		}

		// Call OpenAI API.
		$model    = get_option( 'jbai_model', 'gpt-4o' );
		$response = $this->call_openai( $api_key, $model, $messages_for_api );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$ai_message = $response['choices'][0]['message']['content'];

		// Detect if interview is wrapping up.
		$is_complete = false;
		if ( stripos( $ai_message, '[FINAL]' ) !== false ) {
			$ai_message  = trim( str_ireplace( '[FINAL]', '', $ai_message ) );
			$is_complete = true;
		} elseif ( $round >= 12 ) {
			$is_complete = true;
		}

		// Add AI response to conversation.
		$conversation[] = array( 'role' => 'assistant', 'content' => $ai_message );

		// Save conversation and completion status.
		$this->save_conversation( $post_id, $conversation );
		if ( $is_complete ) {
			update_post_meta( $post_id, '_jbai_interview_complete', '1' );
		}

		// The round for display: after a start it's round 1 question, after user answers it's the next question.
		$display_round = $round + 1;

		return rest_ensure_response( array(
			'question'     => $ai_message,
			'round'        => $display_round,
			'total_rounds' => '8-12',
			'is_complete'  => $is_complete,
			'usage'        => isset( $response['usage'] ) ? $response['usage'] : null,
		) );
	}

	/**
	 * Handle format endpoint — convert conversation to WordPress blocks.
	 */
	public function handle_format( $request ) {
		$post_id      = $request->get_param( 'post_id' );
		$conversation = $this->get_conversation( $post_id );

		if ( empty( $conversation ) ) {
			return new WP_Error( 'no_conversation', 'No interview conversation found for this post.', array( 'status' => 404 ) );
		}

		$blocks         = array();
		$exchange_count = 0;
		$question       = null;

		foreach ( $conversation as $msg ) {
			if ( 'system' === $msg['role'] ) {
				continue;
			}

			if ( 'assistant' === $msg['role'] ) {
				$question = $msg['content'];
			}

			if ( 'user' === $msg['role'] && null !== $question ) {
				$exchange_count++;
				$blocks[] = $this->build_exchange_block( $question, $msg['content'] );
				$question = null;
			}
		}

		// If there's a trailing question with no answer yet, include it.
		if ( null !== $question ) {
			$exchange_count++;
			$blocks[] = $this->build_exchange_block( $question, '' );
		}

		$content = implode( "\n\n", $blocks );

		return rest_ensure_response( array(
			'content'        => $content,
			'exchange_count' => $exchange_count,
		) );
	}

	/**
	 * Handle complete endpoint — mark interview as done.
	 */
	public function handle_complete( $request ) {
		$post_id = $request->get_param( 'post_id' );
		update_post_meta( $post_id, '_jbai_interview_complete', '1' );
		return rest_ensure_response( array( 'success' => true ) );
	}

	/**
	 * Handle reset endpoint — clear conversation.
	 */
	public function handle_reset( $request ) {
		$post_id = $request->get_param( 'post_id' );
		delete_post_meta( $post_id, '_jbai_conversation' );
		delete_post_meta( $post_id, '_jbai_interview_subject' );
		delete_post_meta( $post_id, '_jbai_interview_angle' );
		delete_post_meta( $post_id, '_jbai_interview_audience' );
		delete_post_meta( $post_id, '_jbai_interview_complete' );

		return rest_ensure_response( array( 'success' => true ) );
	}

	/**
	 * Call the OpenAI Chat Completions API.
	 */
	private function call_openai( $api_key, $model, $messages ) {
		$response = wp_remote_post( 'https://api.openai.com/v1/chat/completions', array(
			'headers' => array(
				'Content-Type'  => 'application/json',
				'Authorization' => 'Bearer ' . $api_key,
			),
			'body'    => wp_json_encode( array(
				'model'       => $model,
				'messages'    => $messages,
				'temperature' => 0.8,
				'max_tokens'  => 500,
			) ),
			'timeout' => 60,
		) );

		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'api_error', 'OpenAI request failed: ' . $response->get_error_message(), array( 'status' => 502 ) );
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code !== 200 ) {
			$msg = isset( $body['error']['message'] ) ? $body['error']['message'] : 'HTTP ' . $code;
			return new WP_Error( 'api_error', 'OpenAI API error: ' . $msg, array( 'status' => $code ) );
		}

		if ( empty( $body['choices'][0]['message']['content'] ) ) {
			return new WP_Error( 'api_error', 'Empty response from OpenAI.', array( 'status' => 502 ) );
		}

		return $body;
	}

	/**
	 * Build a single Q&A exchange in WordPress block markup.
	 * Matches the structure from patterns/interview-question.php.
	 */
	private function build_exchange_block( $question, $answer ) {
		$q = esc_html( $question );
		$a = esc_html( $answer );

		$answer_block = '';
		if ( ! empty( $answer ) ) {
			$answer_block = '<!-- wp:group {"className":"interview-answer","style":{"spacing":{"padding":{"left":"var:preset|spacing|10"}},"margin":{"bottom":"var:preset|spacing|10"}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group interview-answer" style="padding-left:var(--wp--preset--spacing--10)">

<!-- wp:paragraph {"className":"interviewee","style":{"typography":{"fontSize":"var:preset|font-size|medium","lineHeight":"1.8"}}} -->
<p class="interviewee" style="font-size:var(--wp--preset--font-size--medium);line-height:1.8"><strong>Josh:</strong> ' . $a . '</p>
<!-- /wp:paragraph -->

</div>
<!-- /wp:group -->';
		}

		return '<!-- wp:group {"className":"interview-exchange jb-fade-in","style":{"spacing":{"margin":{"bottom":"var:preset|spacing|40"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group interview-exchange jb-fade-in" style="margin-bottom:var(--wp--preset--spacing--40)">

<!-- wp:group {"className":"interview-question","style":{"spacing":{"padding":{"left":"var:preset|spacing|30"},"margin":{"bottom":"var:preset|spacing|20"}},"border":{"left":{"color":"var:preset|color|secondary","width":"3px","style":"solid"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group interview-question" style="border-left-color:var(--wp--preset--color--secondary);border-left-style:solid;border-left-width:3px;margin-bottom:var(--wp--preset--spacing--20);padding-left:var(--wp--preset--spacing--30)">

<!-- wp:paragraph {"className":"interviewer","style":{"typography":{"fontStyle":"italic","fontSize":"var:preset|font-size|medium","lineHeight":"1.7"}},"textColor":"primary","fontFamily":"heading"} -->
<p class="interviewer has-primary-color has-text-color has-heading-font-family" style="font-size:var(--wp--preset--font-size--medium);font-style:italic;line-height:1.7"><strong>AI:</strong> ' . $q . '</p>
<!-- /wp:paragraph -->

</div>
<!-- /wp:group -->

' . $answer_block . '

</div>
<!-- /wp:group -->';
	}

	/**
	 * Get conversation from post meta.
	 */
	private function get_conversation( $post_id ) {
		$data = get_post_meta( $post_id, '_jbai_conversation', true );
		if ( empty( $data ) ) {
			return array();
		}
		$decoded = json_decode( $data, true );
		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * Save conversation to post meta.
	 */
	private function save_conversation( $post_id, $conversation ) {
		update_post_meta( $post_id, '_jbai_conversation', wp_json_encode( $conversation ) );
	}
}
