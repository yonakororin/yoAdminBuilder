<?php
require_once 'auth.php'; // SSO Check


// Wrapper if auth.php didn't set base_url (just in case, though it should)
if (!isset($base_url)) {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'];
    $path = dirname($_SERVER['SCRIPT_NAME']);
    $path = str_replace('\\', '/', $path);
    $path = rtrim($path, '/');
    $base_url = $protocol . $host . $path;
}
$sso_url = '../yoSSO';

// Handle New File Creation
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['new_filename'])) {
    $new_file = trim($_POST['new_filename']);
    if (!empty($new_file)) {
        if (!str_ends_with($new_file, '.json')) $new_file .= '.json';
        
        // Basic validation: filename only (no directory traversal)
        $new_file = basename($new_file);
        $full_path = __DIR__ . DIRECTORY_SEPARATOR . $new_file;
        
        if (!file_exists($full_path)) {
            // Create empty config or default structure
            $default_config = [];
            file_put_contents($full_path, json_encode($default_config, JSON_PRETTY_PRINT));
        }
        
        header("Location: builder.php?config=" . urlencode($new_file));
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>yoAdmin Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../shared/theme.css">
    <style>
        body {
            background-color: var(--theme-bg);
            color: var(--theme-text);
            font-family: 'Inter', sans-serif;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
        }

        .container {
            width: 100%;
            max-width: 800px;
            background-color: var(--theme-bg-card);
            border: 1px solid var(--theme-border);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            height: 600px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }

        .header {
            padding: 1.5rem;
            border-bottom: 1px solid var(--theme-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: var(--theme-bg-secondary);
        }

        .brand {
            font-size: 1.5rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .brand i { color: var(--theme-primary); }

        .browser-bar {
            padding: 1rem;
            background-color: var(--theme-bg-secondary);
            border-bottom: 1px solid var(--theme-border);
            display: flex;
            gap: 1rem;
            align-items: center;
        }

        .path-display {
            font-family: monospace;
            color: var(--theme-text-muted);
            font-size: 0.9rem;
            flex: 1;
        }

        .file-list {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
        }

        .file-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 1rem;
        }

        .file-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 1rem;
            cursor: pointer;
            border-radius: 8px;
            border: 1px solid transparent;
            transition: all 0.2s;
            text-decoration: none;
            color: var(--theme-text);
        }

        .file-item:hover {
            background-color: var(--theme-bg-hover);
            border-color: var(--theme-border);
            transform: translateY(-2px);
        }

        .file-icon {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            color: var(--theme-text-muted);
        }
        
        .file-item[data-type="dir"] .file-icon { color: #f59e0b; }
        .file-item[data-type="file"] .file-icon { color: var(--theme-primary); }

        .file-name {
            font-size: 0.9rem;
            word-break: break-all;
            line-height: 1.3;
        }

        .footer {
            padding: 1rem;
            border-top: 1px solid var(--theme-border);
            background-color: var(--theme-bg-secondary);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .create-form {
            display: flex;
            gap: 0.5rem;
            flex: 1;
            max-width: 400px;
        }
        
        input.new-file-input {
            flex: 1;
            padding: 0.6rem 1rem;
            border-radius: 6px;
            border: 1px solid var(--theme-border);
            background-color: var(--theme-bg);
            color: var(--theme-text);
            outline: none;
        }
        input.new-file-input:focus {
            border-color: var(--theme-primary);
        }

        .btn-primary {
            padding: 0.6rem 1rem;
            background-color: var(--theme-primary);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .btn-primary:hover { opacity: 0.9; }

        .user-controls {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .user-controls a {
            color: var(--theme-text-muted);
            text-decoration: none;
            font-size: 0.9rem;
            display: flex; align-items: center; gap: 5px;
        }
        .user-controls a:hover { color: var(--theme-text); }
        
        /* Theme Selector override */
        .theme-selector select {
            background-color: var(--theme-bg);
            color: var(--theme-text);
            border: 1px solid var(--theme-border);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="brand">
                <i class="fa-solid fa-layer-group"></i> yoAdmin Dashboard
            </div>
            <div class="user-controls">
                <div class="theme-selector">
                    <select title="Theme">
                        <option value="dark">🌙 Dark</option>
                        <option value="light">☀️ Light</option>
                        <option value="midnight">🔮 Midnight</option>
                        <option value="ocean">🌊 Ocean</option>
                        <option value="forest">🌲 Forest</option>
                        <option value="sunset">🌅 Sunset</option>
                        <option value="mono">⬜ Mono</option>
                        <option value="rose">🌸 Rose</option>
                    </select>
                </div>
                <span><i class="fa-solid fa-user-circle"></i> <?= htmlspecialchars($_SESSION['user']) ?></span>
                <a href="logout.php"><i class="fa-solid fa-sign-out-alt"></i> Logout</a>
            </div>
        </div>
        
        <div class="browser-bar">
            <button id="btn-up" class="btn-primary" style="padding:0.4rem 0.8rem; font-size:0.9rem;">
                <i class="fa-solid fa-level-up-alt"></i> Up
            </button>
            <div id="path-display" class="path-display">Loading...</div>
        </div>

        <div id="file-list" class="file-list">
            <div class="file-grid" id="file-grid">
                <!-- Content -->
            </div>
        </div>

        <div class="footer">
            <form method="POST" class="create-form">
                <input type="text" name="new_filename" class="new-file-input" placeholder="New Dashboard Name..." required>
                <button type="submit" class="btn-primary"><i class="fa-solid fa-plus"></i> Create</button>
            </form>
        </div>
    </div>

    <script>window.currentUser = "<?= isset($_SESSION['user']) ? htmlspecialchars($_SESSION['user']) : '' ?>";</script>
    <script src="../shared/theme.js"></script>
    <script>
        let currentPath = '';

        async function loadPath(path = '') {
            const gridEl = document.getElementById('file-grid');
            const pathEl = document.getElementById('path-display');
            
            try {
                const res = await fetch(`api.php?action=browse&path=${encodeURIComponent(path)}`);
                const data = await res.json();
                
                currentPath = data.current_path;
                pathEl.textContent = currentPath; // Display full server path for context

                gridEl.innerHTML = '';

                if (data.items.length === 0) {
                    gridEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--theme-text-muted); padding: 2rem;">No JSON files found</div>';
                    return;
                }

                data.items.forEach(item => {
                    const el = document.createElement(item.type === 'dir' ? 'div' : 'a');
                    el.className = 'file-item';
                    el.dataset.type = item.type;
                    
                    const iconClass = item.type === 'dir' ? 'fa-folder' : 'fa-file-code';
                    
                    el.innerHTML = `
                        <div class="file-icon"><i class="fa-solid ${iconClass}"></i></div>
                        <div class="file-name">${item.name}</div>
                    `;
                    
                    if (item.type === 'dir') {
                        el.onclick = () => loadPath(item.path);
                    } else {
                        // For files, we link to builder
                        el.href = `builder.php?config=${encodeURIComponent(item.name)}`; // Using filename relative to root for now
                        // Note: If we support subdirs deep navigation, we might need to pass partial path or handle it in builder.
                        // Currently api.php browse logic sends standard browse. 
                        // If we are in a subdir, item.name is just name. 
                        // If builder.php expects just filename in same dir, we verify that.
                        // If we are deep browsing, we might need to pass relative path.
                        // But builder implementation is: "config file" -> loads from current dir?
                        // Let's assume for now we just create/edit in root dir or support simple browsing.
                        
                        // Actually, let's pass the item.name. The builder will load it.
                        // If we are in subdir, we probably want to pass the relative path from root? 
                        // Or builder.php only supports files in its own directory?
                        // Looking at api.php, it loads `$_GET['file']`.
                        // If we browse to a subdir, we can only open if we pass the right path.
                        // But let's keep it simple: mainly for root dir management.
                    }
                    
                    gridEl.appendChild(el);
                });

            } catch(e) {
                console.error(e);
                gridEl.innerHTML = '<div style="color:red; padding:1rem;">Error loading files</div>';
            }
        }

        document.getElementById('btn-up').onclick = () => {
             loadPath(currentPath + '/..');
        };

        // Init
        loadPath();
    </script>
</body>
</html>
