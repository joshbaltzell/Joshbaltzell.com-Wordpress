<?php
/**
 * Settings page for JB AI Interviewer.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class JBAI_Settings {

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'wp_ajax_jbai_test_connection', array( $this, 'test_connection' ) );
	}

	/**
	 * Add settings page under Settings menu.
	 */
	public function add_settings_page() {
		add_options_page(
			__( 'JB AI Interviewer', 'jb-ai-interviewer' ),
			__( 'JB AI Interviewer', 'jb-ai-interviewer' ),
			'manage_options',
			'jb-ai-interviewer',
			array( $this, 'render_settings_page' )
		);
	}

	/**
	 * Register settings fields.
	 */
	public function register_settings() {
		register_setting( 'jbai_settings', 'jbai_api_key', array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
		) );
		register_setting( 'jbai_settings', 'jbai_model', array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => 'gpt-4o',
		) );
		register_setting( 'jbai_settings', 'jbai_system_prompt', array(
			'type'              => 'string',
			'sanitize_callback' => 'wp_kses_post',
		) );

		add_settings_section( 'jbai_main', '', '__return_false', 'jb-ai-interviewer' );

		add_settings_field( 'jbai_api_key', __( 'OpenAI API Key', 'jb-ai-interviewer' ), array( $this, 'render_api_key_field' ), 'jb-ai-interviewer', 'jbai_main' );
		add_settings_field( 'jbai_model', __( 'Model', 'jb-ai-interviewer' ), array( $this, 'render_model_field' ), 'jb-ai-interviewer', 'jbai_main' );
		add_settings_field( 'jbai_system_prompt', __( 'System Prompt', 'jb-ai-interviewer' ), array( $this, 'render_prompt_field' ), 'jb-ai-interviewer', 'jbai_main' );
	}

	/**
	 * Render API key field.
	 */
	public function render_api_key_field() {
		$value = get_option( 'jbai_api_key', '' );
		printf(
			'<input type="password" id="jbai_api_key" name="jbai_api_key" value="%s" class="regular-text" autocomplete="off" />',
			esc_attr( $value )
		);
		echo '<button type="button" id="jbai-test-connection" class="button button-secondary" style="margin-left:8px;">';
		esc_html_e( 'Test Connection', 'jb-ai-interviewer' );
		echo '</button>';
		echo '<span id="jbai-test-result" style="margin-left:8px;"></span>';
		$this->inline_test_script();
	}

	/**
	 * Render model dropdown.
	 */
	public function render_model_field() {
		$current = get_option( 'jbai_model', 'gpt-4o' );
		$models  = array(
			'gpt-4o'       => 'GPT-4o',
			'gpt-4o-mini'  => 'GPT-4o Mini',
			'gpt-4-turbo'  => 'GPT-4 Turbo',
			'gpt-3.5-turbo' => 'GPT-3.5 Turbo',
		);
		echo '<select id="jbai_model" name="jbai_model">';
		foreach ( $models as $value => $label ) {
			printf(
				'<option value="%s" %s>%s</option>',
				esc_attr( $value ),
				selected( $current, $value, false ),
				esc_html( $label )
			);
		}
		echo '</select>';
		echo '<p class="description">' . esc_html__( 'GPT-4o recommended for best interview quality.', 'jb-ai-interviewer' ) . '</p>';
	}

	/**
	 * Render system prompt textarea.
	 */
	public function render_prompt_field() {
		$value = get_option( 'jbai_system_prompt', jbai_default_system_prompt() );
		printf(
			'<textarea id="jbai_system_prompt" name="jbai_system_prompt" rows="16" class="large-text code">%s</textarea>',
			esc_textarea( $value )
		);
		echo '<p class="description">';
		esc_html_e( 'Use {SUBJECT}, {ANGLE}, and {AUDIENCE} as placeholders — they will be replaced with values from the interview setup.', 'jb-ai-interviewer' );
		echo '</p>';
		echo '<button type="button" id="jbai-reset-prompt" class="button button-link-delete" style="margin-top:4px;">';
		esc_html_e( 'Reset to Default', 'jb-ai-interviewer' );
		echo '</button>';
	}

	/**
	 * Render the settings page.
	 */
	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'JB AI Interviewer Settings', 'jb-ai-interviewer' ); ?></h1>
			<form method="post" action="options.php">
				<?php
				settings_fields( 'jbai_settings' );
				do_settings_sections( 'jb-ai-interviewer' );
				submit_button();
				?>
			</form>
		</div>
		<?php
	}

	/**
	 * AJAX handler to test the OpenAI connection.
	 */
	public function test_connection() {
		check_ajax_referer( 'jbai_test_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'Unauthorized.' );
		}

		$api_key = isset( $_POST['api_key'] ) ? sanitize_text_field( wp_unslash( $_POST['api_key'] ) ) : get_option( 'jbai_api_key', '' );

		if ( empty( $api_key ) ) {
			wp_send_json_error( 'No API key provided.' );
		}

		$response = wp_remote_get( 'https://api.openai.com/v1/models', array(
			'headers' => array(
				'Authorization' => 'Bearer ' . $api_key,
			),
			'timeout' => 15,
		) );

		if ( is_wp_error( $response ) ) {
			wp_send_json_error( 'Connection failed: ' . $response->get_error_message() );
		}

		$code = wp_remote_retrieve_response_code( $response );
		if ( 200 === $code ) {
			wp_send_json_success( 'Connected successfully.' );
		} else {
			$body = json_decode( wp_remote_retrieve_body( $response ), true );
			$msg  = isset( $body['error']['message'] ) ? $body['error']['message'] : 'HTTP ' . $code;
			wp_send_json_error( 'API error: ' . $msg );
		}
	}

	/**
	 * Inline script for test connection button.
	 */
	private function inline_test_script() {
		$nonce = wp_create_nonce( 'jbai_test_nonce' );
		?>
		<script>
		document.addEventListener('DOMContentLoaded', function() {
			var btn = document.getElementById('jbai-test-connection');
			var result = document.getElementById('jbai-test-result');
			var resetBtn = document.getElementById('jbai-reset-prompt');

			if (btn) {
				btn.addEventListener('click', function() {
					var key = document.getElementById('jbai_api_key').value;
					result.textContent = 'Testing...';
					result.style.color = '#666';

					var fd = new FormData();
					fd.append('action', 'jbai_test_connection');
					fd.append('nonce', '<?php echo esc_js( $nonce ); ?>');
					fd.append('api_key', key);

					fetch(ajaxurl, { method: 'POST', body: fd })
						.then(function(r) { return r.json(); })
						.then(function(data) {
							if (data.success) {
								result.textContent = '✓ ' + data.data;
								result.style.color = '#7A9E7E';
							} else {
								result.textContent = '✗ ' + data.data;
								result.style.color = '#C4785B';
							}
						})
						.catch(function() {
							result.textContent = '✗ Network error';
							result.style.color = '#C4785B';
						});
				});
			}

			if (resetBtn) {
				resetBtn.addEventListener('click', function() {
					if (confirm('Reset the system prompt to the default?')) {
						document.getElementById('jbai_system_prompt').value = <?php echo wp_json_encode( jbai_default_system_prompt() ); ?>;
					}
				});
			}
		});
		</script>
		<?php
	}
}
