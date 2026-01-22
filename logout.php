<?php
require_once __DIR__ . '/../shared/session_config.php';
session_start();
session_destroy();
// Get base URL
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
$host = $_SERVER['HTTP_HOST'];
$path = dirname($_SERVER['SCRIPT_NAME']);
$path = str_replace('\\', '/', $path);
$path = rtrim($path, '/');
$base_url = $protocol . $host . $path;

// Make redirect_uri for SSO
$callback_url = "$base_url/callback.php";
if (isset($_GET['next']) && !empty($_GET['next'])) {
    $callback_url .= "?next=" . urlencode($_GET['next']);
}
$redirect_uri = urlencode($callback_url);
$app_name = urlencode("yoAdmin");

header("Location: ../yoSSO/?redirect_uri=$redirect_uri&app_name=$app_name");
exit;
?>
