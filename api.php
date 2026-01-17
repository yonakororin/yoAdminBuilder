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
        
        // Filter files
        $allowedExts = isset($_GET['exts']) ? explode(',', $_GET['exts']) : ['json'];
        if ($type === 'file') {
            $ext = pathinfo($item, PATHINFO_EXTENSION);
            // If exts contains '*', allow all
            if (!in_array('*', $allowedExts)) {
                 if (!in_array(strtolower($ext), $allowedExts)) continue;
            }
        }
        
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
    $targetFile = $_POST['filename'] ?? $filename;
    $content = $_POST['config'] ?? file_get_contents('php://input');

    if ($content) {
        // Basic security check could go here
        if (!str_ends_with($targetFile, '.json')) $targetFile .= '.json';
        
        file_put_contents($targetFile, $content);
        echo json_encode(['success' => true, 'file' => $targetFile]);
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No data received']);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($filename)) {
        readfile($filename);
    } else {
        echo json_encode([]);
    }
}
