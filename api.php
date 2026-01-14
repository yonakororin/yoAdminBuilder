<?php
require_once 'auth.php';
header('Content-Type: application/json');

// List files
// Browser Action
if (isset($_GET['action']) && $_GET['action'] === 'browse') {
    $base_dir = $_GET['path'] ?? __DIR__;
    // Sanity check: prevent traversing above root if needed, but for dev tool allow system browsing
    if (!is_dir($base_dir)) $base_dir = __DIR__;
    $base_dir = realpath($base_dir);
    
    $items = scandir($base_dir);
    $result = [];
    
    foreach ($items as $item) {
        if ($item === '.') continue;
        $full = $base_dir . DIRECTORY_SEPARATOR . $item;
        $type = is_dir($full) ? 'dir' : 'file';
        
        // Filter files: only JSON
        if ($type === 'file' && !str_ends_with($item, '.json')) continue;
        
        $result[] = [
            'name' => $item,
            'type' => $type,
            'path' => $full
        ];
    }
    
    // Sort: Dirs first, then files
    usort($result, function($a, $b) {
        if ($a['type'] === $b['type']) return strnatcmp($a['name'], $b['name']);
        return ($a['type'] === 'dir') ? -1 : 1;
    });

    echo json_encode([
        'current_path' => $base_dir,
        'items' => $result
    ]);
    exit;
}

// Default file if none specified
$filename = 'data.json';

// Allow overriding file via GET or input
// SECURITY WARNING: In a production environment, this is dangerous without strict validation.
// For this local dev tool, we'll allow basic alphanumeric + .json check.
if (isset($_GET['file'])) {
    $requestedFile = $_GET['file'];
    // Relaxed validation to allow absolute paths from explorer
    if (str_ends_with($requestedFile, '.json')) {
        $filename = $requestedFile;
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid filename (must be .json)']);
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
