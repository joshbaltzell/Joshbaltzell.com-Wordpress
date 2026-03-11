<?php
/**
 * Meta box for the AI Interview chat interface.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class JBAI_Meta_Box {

	public function __construct() {
		add_action( 'add_meta_boxes', array( $this, 'register_meta_box' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
	}

	/**
	 * Register the meta box on ai_interview post type.
	 */
	public function register_meta_box() {
		add_meta_box(
			'jbai-interviewer',
			__( 'AI Interviewer', 'jb-ai-interviewer' ),
			array( $this, 'render_meta_box' ),
			'ai_interview',
			'normal',
			'high'
		);
	}

	/**
	 * Enqueue assets only on ai_interview edit screens.
	 */
	public function enqueue_assets( $hook ) {
		global $post_type;

		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}
		if ( 'ai_interview' !== $post_type ) {
			return;
		}

		wp_enqueue_style(
			'jbai-interviewer',
			JBAI_PLUGIN_URL . 'assets/css/interviewer.css',
			array(),
			JBAI_VERSION
		);

		wp_enqueue_script(
			'jbai-interviewer',
			JBAI_PLUGIN_URL . 'assets/js/interviewer.js',
			array( 'wp-blocks', 'wp-data' ),
			JBAI_VERSION,
			true
		);

		global $post;
		if ( ! $post || ! $post->ID ) {
			return;
		}

		$conversation = get_post_meta( $post->ID, '_jbai_conversation', true );
		$subject      = get_post_meta( $post->ID, '_jbai_interview_subject', true );
		$angle        = get_post_meta( $post->ID, '_jbai_interview_angle', true );
		$audience     = get_post_meta( $post->ID, '_jbai_interview_audience', true );
		$is_complete  = get_post_meta( $post->ID, '_jbai_interview_complete', true );

		wp_localize_script( 'jbai-interviewer', 'jbaiConfig', array(
			'restUrl'        => rest_url( 'jb-interviewer/v1/' ),
			'nonce'          => wp_create_nonce( 'wp_rest' ),
			'postId'         => $post->ID,
			'conversation'   => $conversation ? json_decode( $conversation, true ) : array(),
			'subject'        => $subject ? $subject : '',
			'angle'          => $angle ? $angle : '',
			'audience'       => $audience ? $audience : '',
			'isComplete'     => ! empty( $is_complete ),
			'hasApiKey'      => ! empty( get_option( 'jbai_api_key', '' ) ),
			'hasGeminiKey'   => ! empty( get_option( 'jbai_gemini_api_key', '' ) ),
			'featuredImage'  => get_post_thumbnail_id( $post->ID ),
		) );
	}

	/**
	 * Render the meta box HTML shell.
	 */
	public function render_meta_box( $post ) {
		$has_key = ! empty( get_option( 'jbai_api_key', '' ) );
		?>
		<div id="jbai-app" class="jbai-app">
			<?php if ( ! $has_key ) : ?>
				<div class="jbai-notice jbai-notice-warning">
					<p>
						<?php
						printf(
							/* translators: %s: settings page URL */
							wp_kses(
								__( 'OpenAI API key not configured. <a href="%s">Set it up in Settings</a>.', 'jb-ai-interviewer' ),
								array( 'a' => array( 'href' => array() ) )
							),
							esc_url( admin_url( 'options-general.php?page=jb-ai-interviewer' ) )
						);
						?>
					</p>
				</div>
			<?php endif; ?>

			<!-- Setup Panel -->
			<div id="jbai-setup" class="jbai-panel">
				<div class="jbai-setup-header">
					<h3><?php esc_html_e( 'Start a New Interview', 'jb-ai-interviewer' ); ?></h3>
					<p class="jbai-setup-desc"><?php esc_html_e( 'Define your topic, then start the conversation. The AI will ask questions one at a time.', 'jb-ai-interviewer' ); ?></p>
				</div>
				<div class="jbai-setup-fields">
					<div class="jbai-field">
						<label for="jbai-subject"><?php esc_html_e( 'Subject', 'jb-ai-interviewer' ); ?></label>
						<input type="text" id="jbai-subject" placeholder="<?php esc_attr_e( 'e.g., Why most e-commerce replatforming projects fail', 'jb-ai-interviewer' ); ?>" />
					</div>
					<div class="jbai-field">
						<label for="jbai-angle"><?php esc_html_e( 'Angle / Thesis', 'jb-ai-interviewer' ); ?></label>
						<input type="text" id="jbai-angle" placeholder="<?php esc_attr_e( 'e.g., The problem is almost never the technology', 'jb-ai-interviewer' ); ?>" />
					</div>
					<div class="jbai-field">
						<label for="jbai-audience"><?php esc_html_e( 'Target Audience', 'jb-ai-interviewer' ); ?></label>
						<input type="text" id="jbai-audience" placeholder="<?php esc_attr_e( 'e.g., Tech leaders evaluating platform migrations', 'jb-ai-interviewer' ); ?>" />
					</div>
				</div>
				<button type="button" id="jbai-start" class="button button-primary button-large" <?php echo $has_key ? '' : 'disabled'; ?>>
					<?php esc_html_e( 'Start Interview', 'jb-ai-interviewer' ); ?>
				</button>
			</div>

			<!-- Chat Panel -->
			<div id="jbai-chat" class="jbai-panel" style="display:none;">
				<div class="jbai-chat-header">
					<span id="jbai-round-badge" class="jbai-round-badge"><?php esc_html_e( 'Round 1 of 8-12', 'jb-ai-interviewer' ); ?></span>
					<span id="jbai-status" class="jbai-status"></span>
				</div>
				<div id="jbai-messages" class="jbai-messages"></div>
				<div id="jbai-typing" class="jbai-typing" style="display:none;">
					<span class="jbai-dot"></span>
					<span class="jbai-dot"></span>
					<span class="jbai-dot"></span>
				</div>
				<div id="jbai-input-area" class="jbai-input-area">
					<textarea id="jbai-input" class="jbai-input" rows="3" placeholder="<?php esc_attr_e( 'Type your answer... (Enter to send, Shift+Enter for newline)', 'jb-ai-interviewer' ); ?>"></textarea>
					<button type="button" id="jbai-send" class="button button-primary"><?php esc_html_e( 'Send', 'jb-ai-interviewer' ); ?></button>
				</div>
				<div class="jbai-actions">
					<button type="button" id="jbai-end" class="button" style="display:none;"><?php esc_html_e( 'End Interview', 'jb-ai-interviewer' ); ?></button>
					<button type="button" id="jbai-format" class="button button-primary" style="display:none;"><?php esc_html_e( 'Format & Insert into Post', 'jb-ai-interviewer' ); ?></button>
					<button type="button" id="jbai-reset" class="button button-link-delete"><?php esc_html_e( 'Reset Interview', 'jb-ai-interviewer' ); ?></button>
				</div>
			</div>

			<!-- Error Display -->
			<div id="jbai-error" class="jbai-notice jbai-notice-error" style="display:none;">
				<p id="jbai-error-msg"></p>
				<button type="button" id="jbai-retry" class="button button-small"><?php esc_html_e( 'Retry', 'jb-ai-interviewer' ); ?></button>
			</div>

			<!-- Artwork Generation Panel -->
			<div id="jbai-artwork" class="jbai-panel jbai-artwork-panel">
				<div class="jbai-artwork-header">
					<h3><?php esc_html_e( 'Generate Featured Artwork', 'jb-ai-interviewer' ); ?></h3>
					<p class="jbai-setup-desc"><?php esc_html_e( 'Generate AI watercolor artwork for this interview using Google Imagen.', 'jb-ai-interviewer' ); ?></p>
				</div>
				<?php if ( empty( get_option( 'jbai_gemini_api_key', '' ) ) ) : ?>
					<div class="jbai-notice jbai-notice-warning">
						<p>
							<?php
							printf(
								wp_kses(
									__( 'Gemini API key not configured. <a href="%s">Set it up in Settings</a>.', 'jb-ai-interviewer' ),
									array( 'a' => array( 'href' => array() ) )
								),
								esc_url( admin_url( 'options-general.php?page=jb-ai-interviewer' ) )
							);
							?>
						</p>
					</div>
				<?php else : ?>
					<div class="jbai-field">
						<label for="jbai-artwork-prompt"><?php esc_html_e( 'Custom Prompt (optional)', 'jb-ai-interviewer' ); ?></label>
						<textarea id="jbai-artwork-prompt" class="jbai-input" rows="2" placeholder="<?php esc_attr_e( 'Leave empty to auto-generate from interview subject...', 'jb-ai-interviewer' ); ?>"></textarea>
					</div>
					<button type="button" id="jbai-generate-artwork" class="button button-primary">
						<?php esc_html_e( 'Generate 4 Variations', 'jb-ai-interviewer' ); ?>
					</button>
					<div id="jbai-artwork-loading" class="jbai-artwork-loading" style="display:none;">
						<span class="spinner is-active"></span>
						<span><?php esc_html_e( 'Generating watercolor artwork...', 'jb-ai-interviewer' ); ?></span>
					</div>
					<div id="jbai-artwork-grid" class="jbai-artwork-grid" style="display:none;"></div>
					<div id="jbai-artwork-error" class="jbai-notice jbai-notice-error" style="display:none;">
						<p id="jbai-artwork-error-msg"></p>
					</div>
				<?php endif; ?>
			</div>
		</div>
		<?php
	}
}
