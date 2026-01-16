<?php
session_start();

$sso_path = __DIR__ . '/../yoSSO';
$codes_file = $sso_path . '/data/codes.json';

$code = $_GET['code'] ?? '';

if (!$code) {
    die("Login failed: No code provided.");
}

if (!file_exists($codes_file)) {
    die("SSO Configuration Error: Codes file not found.");
}

$codes = json_decode(file_get_contents($codes_file), true);

if (isset($codes[$code])) {
    $data = $codes[$code];
    if ($data['expires_at'] > time()) {
        // Valid
        $_SESSION['user'] = $data['username'];
        $_SESSION['login_time'] = time();
        
        // Cleanup
        unset($codes[$code]);
        file_put_contents($codes_file, json_encode($codes));
        
        // Redirect to builder (default page)
        header("Location: builder.php");
        exit;
    } else {
        die("Login failed: Code expired.");
    }
} else {
    die("Login failed: Invalid code.");
}
?>
