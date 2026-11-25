<?php
/**
 * Plugin Name: JB Toy Files
 * Description: Add small browser toys from the admin. Upload a ZIP of a toy's folder, or paste a one-page toy, and WordPress serves it from its own frozen version folder, /wp-content/uploads/toys/<name>/v<n>/. Every upload is a new version and old versions never change, so an article that embeds one keeps showing it. Posts → Toy files. Administrators only.
 * Version: 1.0.0
 *
 * In a post: [game name="Price the Lemonade" toy="price-the-lemonade" version="1"] (the theme turns toy and
 * version into the address). Leave version out to get the newest.
 */

defined( 'ABSPATH' ) || exit;

const JB_TOYS_FOLDER    = 'toys';
const JB_TOYS_MAX_BYTES = 60 * 1024 * 1024; // what one toy may unpack to
const JB_TOYS_MAX_FILES = 3000;

/**
 * The file types a toy may contain. Anything else in a ZIP is skipped, so nothing a server would run gets in.
 *
 * @return string[]
 */
function jb_toys_allowed_types() {
	return array( 'html', 'htm', 'js', 'mjs', 'css', 'json', 'map', 'txt', 'md', 'csv', 'xml', 'vtt', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp', 'woff', 'woff2', 'ttf', 'otf', 'mp3', 'ogg', 'oga', 'wav', 'm4a', 'aac', 'flac', 'mp4', 'webm', 'glb', 'gltf', 'bin', 'wasm' );
}

/**
 * Where toys live on disk and on the web.
 *
 * @return array{dir: string, url: string}
 */
function jb_toys_base() {
	$up = wp_upload_dir( null, false );
	return array(
		'dir' => trailingslashit( $up['basedir'] ) . JB_TOYS_FOLDER,
		'url' => trailingslashit( $up['baseurl'] ) . JB_TOYS_FOLDER,
	);
}

/**
 * The version numbers a toy has, oldest first.
 *
 * @param string $slug The toy's name.
 * @return int[]
 */
function jb_toy_versions( $slug ) {
	$dir = jb_toys_base()['dir'] . '/' . sanitize_title( $slug );
	$out = array();
	if ( ! is_dir( $dir ) ) {
		return $out;
	}
	foreach ( (array) scandir( $dir ) as $entry ) {
		if ( preg_match( '/^v(\d+)$/', $entry, $m ) && is_dir( "$dir/$entry" ) ) {
			$out[] = (int) $m[1];
		}
	}
	sort( $out );
	return $out;
}

/**
 * Every toy, with its versions.
 *
 * @return array<string, int[]>
 */
function jb_toys_all() {
	$dir = jb_toys_base()['dir'];
	$out = array();
	if ( ! is_dir( $dir ) ) {
		return $out;
	}
	foreach ( (array) scandir( $dir ) as $entry ) {
		if ( '.' !== $entry[0] && is_dir( "$dir/$entry" ) ) {
			$out[ $entry ] = jb_toy_versions( $entry );
		}
	}
	ksort( $out );
	return $out;
}

/**
 * The page a version opens on: index.html when there is one, otherwise its first HTML page.
 *
 * @param string $slug    The toy's name.
 * @param int    $version The version.
 * @return string File name, or '' when the version has no page.
 */
function jb_toy_entry( $slug, $version ) {
	$dir = jb_toys_base()['dir'] . '/' . sanitize_title( $slug ) . '/v' . (int) $version;
	foreach ( array( 'index.html', 'index.htm' ) as $file ) {
		if ( is_file( "$dir/$file" ) ) {
			return $file;
		}
	}
	$pages = glob( "$dir/*.htm*" );
	return $pages ? basename( $pages[0] ) : '';
}

/**
 * The address of a toy's page. Version 0 means the newest.
 *
 * @param string $slug    The toy's name.
 * @param int    $version The version, or 0.
 * @return string The address, or '' when there is no such toy or version.
 */
function jb_toy_url( $slug, $version = 0 ) {
	$slug     = sanitize_title( $slug );
	$versions = jb_toy_versions( $slug );
	if ( ! $versions ) {
		return '';
	}
	$version = (int) $version ? (int) $version : (int) end( $versions );
	if ( ! in_array( $version, $versions, true ) ) {
		return '';
	}
	$entry = jb_toy_entry( $slug, $version );
	return $entry ? jb_toys_base()['url'] . "/$slug/v$version/$entry" : '';
}

/**
 * Removes a folder and everything in it (used to undo a failed upload).
 *
 * @param string $dir The folder.
 */
function jb_toys_remove_dir( $dir ) {
	if ( ! is_dir( $dir ) ) {
		return;
	}
	foreach ( (array) scandir( $dir ) as $entry ) {
		if ( '.' === $entry || '..' === $entry ) {
			continue;
		}
		$path = "$dir/$entry";
		if ( is_dir( $path ) && ! is_link( $path ) ) {
			jb_toys_remove_dir( $path );
		} else {
			@unlink( $path ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		}
	}
	@rmdir( $dir ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
}

/**
 * Unpacks a toy's ZIP into a version folder. A single folder wrapping everything is stripped, macOS extras and
 * hidden files are left out, any path that tries to leave the folder is refused, and only allowed types are kept.
 *
 * @param string   $zip     The uploaded file.
 * @param string   $dest    The new version folder.
 * @param string[] $skipped Filled with the names that were left out.
 * @return int|WP_Error Files written.
 */
function jb_toys_unpack( $zip, $dest, &$skipped ) {
	if ( ! class_exists( 'ZipArchive' ) ) {
		return new WP_Error( 'jb_toys', __( 'This server cannot open ZIP files (PHP\'s ZipArchive is missing). Paste a one-page toy instead.', 'jb-toybox' ) );
	}
	$z = new ZipArchive();
	if ( true !== $z->open( $zip ) ) {
		return new WP_Error( 'jb_toys', __( 'That file could not be opened as a ZIP.', 'jb-toybox' ) );
	}
	$names = array();
	$total = 0;
	for ( $i = 0; $i < $z->numFiles; $i++ ) {
		$stat = $z->statIndex( $i );
		$name = str_replace( '\\', '/', (string) $stat['name'] );
		if ( '/' === substr( $name, -1 ) || preg_match( '#(^|/)(__MACOSX|\.)#', $name ) ) {
			continue;
		}
		$names[ $i ] = $name;
		$total      += (int) $stat['size'];
	}
	if ( ! $names ) {
		$z->close();
		return new WP_Error( 'jb_toys', __( 'That ZIP has no files in it.', 'jb-toybox' ) );
	}
	if ( count( $names ) > JB_TOYS_MAX_FILES || $total > JB_TOYS_MAX_BYTES ) {
		$z->close();
		/* translators: 1: number of files, 2: size in megabytes. */
		return new WP_Error( 'jb_toys', sprintf( __( 'That ZIP is too big for a toy here (at most %1$d files and %2$d MB unpacked).', 'jb-toybox' ), JB_TOYS_MAX_FILES, JB_TOYS_MAX_BYTES / 1048576 ) );
	}

	// If everything sits in one folder (the usual way a folder gets zipped), unpack its contents instead.
	$top = null;
	$one = true;
	foreach ( $names as $name ) {
		$parts = explode( '/', $name, 2 );
		if ( count( $parts ) < 2 || ( null !== $top && $top !== $parts[0] ) ) {
			$one = false;
			break;
		}
		$top = $parts[0];
	}
	$strip = $one && null !== $top ? strlen( $top ) + 1 : 0;

	$written = 0;
	foreach ( $names as $i => $name ) {
		$rel = (string) substr( $name, $strip );
		$ok  = '' !== $rel && '/' !== $rel[0];
		foreach ( explode( '/', $rel ) as $segment ) {
			if ( '' === $segment || '.' === $segment || '..' === $segment ) {
				$ok = false;
			}
		}
		$type = strtolower( pathinfo( $rel, PATHINFO_EXTENSION ) );
		if ( ! $ok || ! in_array( $type, jb_toys_allowed_types(), true ) ) {
			$skipped[] = $name;
			continue;
		}
		$data = $z->getFromIndex( $i );
		if ( false === $data ) {
			$skipped[] = $name;
			continue;
		}
		$target = $dest . '/' . $rel;
		wp_mkdir_p( dirname( $target ) );
		if ( false !== file_put_contents( $target, $data ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions
			$written++;
		}
	}
	$z->close();
	return $written;
}

/**
 * Who may add toys: administrators who can already post unfiltered HTML (a toy runs its own code on this site).
 *
 * @return bool
 */
function jb_toys_can() {
	return current_user_can( 'manage_options' ) && current_user_can( 'unfiltered_html' );
}

/**
 * The upload: a new version folder from a ZIP or a pasted page, optionally made the Play link of a post.
 */
function jb_toys_handle_upload() {
	if ( ! jb_toys_can() ) {
		wp_die( esc_html__( 'Only administrators can add toys.', 'jb-toybox' ), '', array( 'response' => 403 ) );
	}
	check_admin_referer( 'jb_toy_upload' );

	$back = admin_url( 'edit.php?page=jb-toy-files' );
	$say  = function ( $kind, $text ) use ( $back ) {
		set_transient( 'jb_toy_notice_' . get_current_user_id(), array( $kind, $text ), 120 );
		wp_safe_redirect( $back );
		exit;
	};

	// phpcs:disable WordPress.Security.NonceVerification -- checked above.
	$slug  = sanitize_title( wp_unslash( isset( $_POST['jb_toy_slug'] ) ? (string) $_POST['jb_toy_slug'] : '' ) );
	$paste = trim( wp_unslash( isset( $_POST['jb_toy_html'] ) ? (string) $_POST['jb_toy_html'] : '' ) );
	$file  = isset( $_FILES['jb_toy_zip'] ) && is_array( $_FILES['jb_toy_zip'] ) ? $_FILES['jb_toy_zip'] : null;
	$play  = ! empty( $_POST['jb_toy_play'] );
	// phpcs:enable

	if ( '' === $slug ) {
		$say( 'error', __( 'Give the toy a name first, such as price-the-lemonade.', 'jb-toybox' ) );
	}
	$has_zip = $file && ! empty( $file['tmp_name'] ) && UPLOAD_ERR_OK === (int) $file['error'] && is_uploaded_file( $file['tmp_name'] );
	if ( $file && ! empty( $file['name'] ) && ! $has_zip ) {
		$say( 'error', __( 'The ZIP did not arrive. It may be larger than this server accepts.', 'jb-toybox' ) );
	}
	if ( ! $has_zip && '' === $paste ) {
		$say( 'error', __( 'Choose a ZIP of the toy\'s folder, or paste a one-page toy.', 'jb-toybox' ) );
	}

	$versions = jb_toy_versions( $slug );
	$version  = $versions ? max( $versions ) + 1 : 1;
	$dest     = jb_toys_base()['dir'] . "/$slug/v$version";
	if ( ! wp_mkdir_p( $dest ) ) {
		$say( 'error', __( 'Could not make the folder for this version. Check that the uploads folder can be written to.', 'jb-toybox' ) );
	}

	$skipped = array();
	if ( $has_zip ) {
		$result = jb_toys_unpack( $file['tmp_name'], $dest, $skipped );
	} else {
		$result = false !== file_put_contents( "$dest/index.html", $paste ) ? 1 : 0; // phpcs:ignore WordPress.WP.AlternativeFunctions
	}
	if ( is_wp_error( $result ) || ! $result || '' === jb_toy_entry( $slug, $version ) ) {
		jb_toys_remove_dir( $dest );
		if ( ! jb_toy_versions( $slug ) ) {
			@rmdir( dirname( $dest ) ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		}
		$say( 'error', is_wp_error( $result ) ? $result->get_error_message() : __( 'No page was found to open. A toy needs an index.html (or another .html page) at the top of its folder.', 'jb-toybox' ) );
	}

	$url  = jb_toy_url( $slug, $version );
	$text = sprintf( /* translators: 1: toy name, 2: version, 3: address. */ __( 'Added %1$s v%2$d: %3$s', 'jb-toybox' ), $slug, $version, $url );
	if ( $skipped ) {
		/* translators: %d: number of files. */
		$text .= ' ' . sprintf( _n( '(%d file was left out because its type is not allowed.)', '(%d files were left out because their types are not allowed.)', count( $skipped ), 'jb-toybox' ), count( $skipped ) );
	}
	if ( $play ) {
		$post = get_page_by_path( $slug, OBJECT, 'post' );
		if ( $post ) {
			update_post_meta( $post->ID, 'toy_play_url', esc_url_raw( $url ) );
			/* translators: %s: post title. */
			$text .= ' ' . sprintf( __( 'It is now the Play link of "%s".', 'jb-toybox' ), get_the_title( $post ) );
		} else {
			$text .= ' ' . __( 'No post has that name, so no Play link was changed.', 'jb-toybox' );
		}
	}
	$say( 'success', $text );
}
add_action( 'admin_post_jb_toy_upload', 'jb_toys_handle_upload' );

/**
 * Posts → Toy files.
 */
function jb_toys_menu() {
	add_submenu_page( 'edit.php', __( 'Toy files', 'jb-toybox' ), __( 'Toy files', 'jb-toybox' ), 'manage_options', 'jb-toy-files', 'jb_toys_page' );
}
add_action( 'admin_menu', 'jb_toys_menu' );

/**
 * The page: what's there, and a form to add a toy or a new version.
 */
function jb_toys_page() {
	if ( ! jb_toys_can() ) {
		wp_die( esc_html__( 'Only administrators can add toys.', 'jb-toybox' ) );
	}
	$notice = get_transient( 'jb_toy_notice_' . get_current_user_id() );
	delete_transient( 'jb_toy_notice_' . get_current_user_id() );
	$toys = jb_toys_all();
	?>
<div class="wrap">
	<h1><?php esc_html_e( 'Toy files', 'jb-toybox' ); ?></h1>
	<p><?php esc_html_e( 'Small toys that run in the browser, served from this site. Every upload is a new version (v1, v2 and so on) and old versions never change, so an article that embeds v1 keeps showing v1.', 'jb-toybox' ); ?></p>
	<?php if ( is_array( $notice ) ) : ?>
	<div class="notice notice-<?php echo 'error' === $notice[0] ? 'error' : 'success'; ?>"><p><?php echo esc_html( $notice[1] ); ?></p></div>
	<?php endif; ?>

	<h2><?php esc_html_e( 'Add a toy, or a new version', 'jb-toybox' ); ?></h2>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data">
		<input type="hidden" name="action" value="jb_toy_upload">
		<?php wp_nonce_field( 'jb_toy_upload' ); ?>
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><label for="jb_toy_slug"><?php esc_html_e( 'Name', 'jb-toybox' ); ?></label></th>
				<td>
					<input type="text" class="regular-text code" id="jb_toy_slug" name="jb_toy_slug" list="jb_toy_names" required placeholder="price-the-lemonade">
					<datalist id="jb_toy_names"><?php foreach ( array_keys( $toys ) as $name ) : ?><option value="<?php echo esc_attr( $name ); ?>"><?php endforeach; ?></datalist>
					<p class="description"><?php esc_html_e( 'Lowercase with dashes. Use the same name as the toy\'s post to link them. An existing name gets a new version.', 'jb-toybox' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="jb_toy_zip"><?php esc_html_e( 'ZIP of the toy\'s folder', 'jb-toybox' ); ?></label></th>
				<td>
					<input type="file" id="jb_toy_zip" name="jb_toy_zip" accept=".zip,application/zip">
					<p class="description">
						<?php
						/* translators: %s: maximum upload size. */
						echo esc_html( sprintf( __( 'Needs an index.html at the top. Only web files are kept (HTML, scripts, styles, images, fonts, sound, video, data). Largest upload: %s.', 'jb-toybox' ), size_format( wp_max_upload_size() ) ) );
						?>
					</p>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="jb_toy_html"><?php esc_html_e( 'Or paste a one-page toy', 'jb-toybox' ); ?></label></th>
				<td><textarea class="large-text code" rows="8" id="jb_toy_html" name="jb_toy_html" placeholder="&lt;!doctype html&gt;…"></textarea></td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Play link', 'jb-toybox' ); ?></th>
				<td><label><input type="checkbox" name="jb_toy_play" value="1" checked> <?php esc_html_e( 'Make this version the Play link of the post with the same name', 'jb-toybox' ); ?></label></td>
			</tr>
		</table>
		<?php submit_button( __( 'Upload as a new version', 'jb-toybox' ) ); ?>
	</form>

	<h2><?php esc_html_e( 'Toys on this site', 'jb-toybox' ); ?></h2>
	<?php if ( ! $toys ) : ?>
	<p><?php esc_html_e( 'None yet.', 'jb-toybox' ); ?></p>
	<?php else : ?>
	<table class="widefat striped">
		<thead><tr><th><?php esc_html_e( 'Name', 'jb-toybox' ); ?></th><th><?php esc_html_e( 'Versions', 'jb-toybox' ); ?></th><th><?php esc_html_e( 'Post', 'jb-toybox' ); ?></th><th><?php esc_html_e( 'To embed the newest in an article', 'jb-toybox' ); ?></th></tr></thead>
		<tbody>
		<?php
		foreach ( $toys as $name => $versions ) :
			$post   = get_page_by_path( $name, OBJECT, 'post' );
			$newest = $versions ? (int) end( $versions ) : 0;
			?>
			<tr>
				<td><code><?php echo esc_html( $name ); ?></code></td>
				<td>
					<?php
					foreach ( $versions as $v ) {
						$url = jb_toy_url( $name, $v );
						echo $url ? '<a href="' . esc_url( $url ) . '" target="_blank" rel="noopener">v' . (int) $v . '</a> ' : 'v' . (int) $v . ' ';
					}
					?>
				</td>
				<td><?php echo $post ? '<a href="' . esc_url( get_edit_post_link( $post ) ) . '">' . esc_html( get_the_title( $post ) ) . '</a>' : '&mdash;'; ?></td>
				<td><code>[game name="<?php echo esc_attr( $post ? get_the_title( $post ) : $name ); ?>" toy="<?php echo esc_attr( $name ); ?>" version="<?php echo (int) $newest; ?>"]</code></td>
			</tr>
		<?php endforeach; ?>
		</tbody>
	</table>
	<?php endif; ?>
</div>
	<?php
}
