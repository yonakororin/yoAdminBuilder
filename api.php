<?php
require_once 'auth.php';
header('Content-Type: application/json');

// Default file if none specified
$filename = 'data.json';

// Allow overriding file via GET or input
// SECURITY WARNING: In a production environment, this is dangerous without strict validation.
// For this local dev tool, we'll allow basic alphanumeric + .json check.
if (isset($_GET['file'])) {
    $requestedFile = $_GET['file'];
    // Basic santization: only allow alphanumeric, underscores, hyphens, and .json
    if (preg_match('/^[a-zA-Z0-9_\-\.]+\.json$/', $requestedFile)) {
        $filename = $requestedFile;
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid filename']);
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    if ($input) {
        file_put_contents($filename, $input);
        echo json_encode(['status' => 'success', 'file' => $filename]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'No data received']);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($filename)) {
        readfile($filename);
    } else {
        echo json_encode([]);
    }
}
