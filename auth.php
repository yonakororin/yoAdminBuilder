<?php
session_start();

// Configuration
$sso_url = '../yoSSO/';

function get_current_base_url() {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'];
    $path = dirname($_SERVER['SCRIPT_NAME']);
    $path = str_replace('\\', '/', $path);
    $path = rtrim($path, '/');
    return $protocol . $host . $path;
}

$base_url = get_current_base_url();

// 1. Check if already logged in (unified session key 'user')
if (!isset($_SESSION['user'])) {
    // Redirect to SSO
    $redirect_uri = urlencode("$base_url/callback.php");
    header("Location: $sso_url?redirect_uri=$redirect_uri");
    exit;
}

// 1.5 Check Session Timeout (12 hours = 43200 seconds)
$timeout_duration = 12 * 60 * 60;
if (isset($_SESSION['login_time'])) {
    if ((time() - $_SESSION['login_time']) > $timeout_duration) {
        // Session expired
        session_destroy();
        $redirect_uri = urlencode("$base_url/callback.php");
        header("Location: $sso_url?redirect_uri=$redirect_uri");
        exit;
    }
} else {
    // If login_time is missing (old session), set it now or force relogin?
    // Let's set it now to avoid immediate logout for existing users, 
    // effectively starting the 12h timer from now.
    $_SESSION['login_time'] = time();
}

// Debug: Check session if requested
if (isset($_GET['debug_session'])) {
    echo "<pre>";
    print_r($_SESSION);
    echo "</pre>";
    exit;
}

// Authenticated - script execution continues in the file that required this
?>
