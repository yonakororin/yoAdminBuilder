<?php
session_start();

// Configuration
// Using relative path for SSO URL to support flexible deployments (Nginx/Apache under a subpath)
// Assumes yoSSO is a sibling directory.
$sso_url = '../yoSSO/';
$sso_path = __DIR__ . '/../yoSSO'; // Path to yoSSO directory on disk
$codes_file = $sso_path . '/data/codes.json';

function get_current_url() {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'];
    $uri = $_SERVER['REQUEST_URI'];
    return $protocol . $host . $uri;
}

// 1. Check if already logged in
if (isset($_SESSION['yo_user'])) {
    return; // Authenticated
}

// 2. Check for SSO Code
if (isset($_GET['code'])) {
    $code = $_GET['code'];
    
    // Validate code directly against file system to avoid HTTP request complexity
    // Validate code directly against file system
    if (file_exists($codes_file)) {
        $codes = json_decode(file_get_contents($codes_file), true);
        
        if (isset($codes[$code])) {
            $data = $codes[$code];
            if ($data['expires_at'] > time()) {
                // Valid!
                $_SESSION['yo_user'] = $data['username'];
                
                // Invalidate code (cleanup)
                unset($codes[$code]);
                file_put_contents($codes_file, json_encode($codes));
                
                // Redirect clean
                $parts = parse_url(get_current_url());
                parse_str($parts['query'] ?? '', $query);
                unset($query['code']);
                $new_query = http_build_query($query);
                $target = $parts['path'] . ($new_query ? '?' . $new_query : '');
                
                header("Location: " . $target);
                exit;
            } else {
                echo "Code expired. <a href='$sso_url'>Login again</a>";
                exit;
            }
        } else {
            echo "Invalid code. <a href='$sso_url'>Login again</a>";
            exit;
        }
    } else {
        echo "Error: Codes file not accessible at $codes_file";
        exit;
    }
}

// 3. Not valid or no code -> Redirect to SSO
$redirect_uri = urlencode(get_current_url());
header("Location: $sso_url?redirect_uri=$redirect_uri");
exit;
?>
