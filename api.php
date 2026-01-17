<?php
require_once 'auth.php';
header('Content-Type: application/json');

// List files
// Browser Action
if (isset($_GET['action']) && $_GET['action'] === 'browse') {
    $requested_path = $_GET['path'] ?? '';
    
    // If path is empty or not set, start at __DIR__
    if (empty($requested_path)) {
        $base_dir = __DIR__;
    } else {
        // Try to resolve relative paths from __DIR__
        if (!is_dir($requested_path)) {
            // Maybe it's a relative path - try resolving from __DIR__
            $relative_attempt = __DIR__ . DIRECTORY_SEPARATOR . $requested_path;
            if (is_dir($relative_attempt)) {
                $base_dir = $relative_attempt;
            } else {
                $base_dir = __DIR__;
            }
        } else {
            $base_dir = $requested_path;
        }
    }
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

// Read file action - for loading HTML component files
if (isset($_GET['action']) && $_GET['action'] === 'readfile') {
    $path = $_GET['path'] ?? '';
    if (empty($path) || !file_exists($path)) {
        http_response_code(404);
        echo json_encode(['error' => 'File not found']);
        exit;
    }
    // Return raw file content (for HTML/JS files)
    header('Content-Type: text/html; charset=UTF-8');
    readfile($path);
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
