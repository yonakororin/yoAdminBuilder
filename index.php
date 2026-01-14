<?php
require_once 'auth.php'; // SSO Check

function get_current_base_url() {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'];
    $path = dirname($_SERVER['SCRIPT_NAME']);
    $path = str_replace('\\', '/', $path);
    $path = rtrim($path, '/');
    return $protocol . $host . $path;
}

$base_url = get_current_base_url();
$sso_url = '../yoSSO';

// Handle New File Creation
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['new_filename'])) {
    $new_file = trim($_POST['new_filename']);
    if (!str_ends_with($new_file, '.json')) $new_file .= '.json';
    
    // Use current path from hidden input if available, else default
    $current_path = $_POST['current_path'] ?? __DIR__;
    $full_path = $current_path . DIRECTORY_SEPARATOR . $new_file;
    
    // We pass the full path to builder now? Or just filename if in same dir?
    // Let's pass full path if supported by builder. 
    // Wait, builder implementation of saving might assume local file.
    // Let's check api.php saving logic for builder...
    // api.php receives 'file' param. If we send full path there, does it work?
    // "preg_match('/^[a-zA-Z0-9_\-\.]+\.json$/', $requestedFile)" -> This prevents full paths.
    // So we can only support current directory for NEW files or we need to update api.php to support paths.
    // For now, let's just create in local directory OR update api.php in next step if critical.
    // User asked for "file picking", usually implies standard open.
    // If I want to support editing files elsewhere, I MUST update api.php validation.
    
    // Let's first make the browser work, and for creation, just default to local dir.
    header("Location: builder.php?config=" . urlencode($new_file));
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>yoAdminBuilder Launcher</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #0f172a;
            --bg-card: #1e293b;
            --bg-hover: #334155;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent: #3b82f6;
            --border: #334155;
            --font-sans: 'Inter', sans-serif;
        }

        body {
            background-color: var(--bg-dark);
            color: var(--text-primary);
            font-family: var(--font-sans);
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
        }

        .container {
            width: 100%;
            max-width: 600px;
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            height: 500px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .header {
            padding: 1.5rem;
            border-bottom: 1px solid var(--border);
            text-align: center;
        }

        .header h1 {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 600;
        }
        .header span { color: var(--accent); }

        .browser-bar {
            padding: 0.75rem 1rem;
            background-color: rgba(0,0,0,0.2);
            display: flex;
            gap: 0.5rem;
            align-items: center;
            border-bottom: 1px solid var(--border);
        }

        .path-input {
            flex: 1;
            background: transparent;
            border: none;
            color: var(--text-secondary);
            font-family: monospace;
            font-size: 0.9rem;
        }

        .file-list {
            flex: 1;
            overflow-y: auto;
            padding: 0.5rem;
        }

        .file-item {
            display: flex;
            align-items: center;
            padding: 0.5rem 1rem;
            cursor: pointer;
            border-radius: 4px;
            color: var(--text-primary);
            text-decoration: none;
            transition: background 0.1s;
        }

        .file-item:hover {
            background-color: var(--bg-hover);
        }

        .file-icon {
            margin-right: 0.75rem;
            width: 20px;
            text-align: center;
        }
        
        .footer {
            padding: 1rem;
            border-top: 1px solid var(--border);
        }

        .user-info {
            text-align: center;
            margin-top: 0.5rem;
            color: var(--text-secondary);
            font-size: 0.8rem;
        }
        .user-info a { color: var(--accent); text-decoration: none; margin-left:10px; }

        /* Create New Form */
        .create-form {
            display: flex;
            gap: 0.5rem;
        }
        input.new-file-input {
            flex: 1;
            padding: 0.5rem;
            border-radius: 4px;
            border: 1px solid var(--border);
            background-color: var(--bg-dark);
            color: white;
        }
        button.btn-primary {
            padding: 0.5rem 1rem;
            background-color: var(--accent);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>yoAdmin<span>Builder</span></h1>
        </div>
        
        <div class="browser-bar">
            <button id="btn-up" class="btn-primary" style="padding:0.25rem 0.5rem;">⬆</button>
            <input type="text" id="current-path" class="path-input" readonly value="...">
        </div>

        <div id="file-list" class="file-list">
            <!-- Content -->
            <div style="text-align:center; padding:2rem; color:var(--text-secondary);">Loading...</div>
        </div>

        <div class="footer">
            <form method="POST" class="create-form">
                <input type="hidden" name="current_path" id="form-current-path">
                <input type="text" name="new_filename" class="new-file-input" placeholder="Create new config..." required>
                <button type="submit" class="btn-primary">Create</button>
            </form>
            <div class="user-info">
                User: <strong><?= htmlspecialchars($_SESSION['user']) ?></strong>
                <a href="<?= htmlspecialchars($sso_url) ?>/change_password.php?redirect_uri=<?= urlencode($base_url . '/') ?>">Password</a>
                <a href="<?= htmlspecialchars($sso_url) ?>/index.php?logout=1" style="color:var(--text-secondary)">Logout</a>
            </div>
        </div>
    </div>

    <script>
        let currentPath = '';

        async function loadPath(path = '') {
            const listEl = document.getElementById('file-list');
            try {
                const res = await fetch(`api.php?action=browse&path=${encodeURIComponent(path)}`);
                const data = await res.json();
                
                currentPath = data.current_path;
                document.getElementById('current-path').value = currentPath;
                document.getElementById('form-current-path').value = currentPath;

                listEl.innerHTML = '';

                data.items.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'file-item';
                    const icon = item.type === 'dir' ? '📁' : '📄';
                    
                    row.innerHTML = `<span class="file-icon">${icon}</span><span>${item.name}</span>`;
                    
                    row.onclick = () => {
                        if (item.type === 'dir') {
                            loadPath(item.path);
                        } else {
                            // Open Builder with this file
                            // Since builder/api might restrict paths, strictly speaking we should fix validation there too.
                            // But for now, let's assume relative or absolute works if we fix validation.
                            // We will send the full path as config param.
                            // But wait, PHP API validation blocks paths with slashes.
                            // We need to fix that first. For now, try passing just name if in current dir?
                            // No, explorer allows going anywhere. We MUST fix API validation. which I will do next.
                            window.location.href = `builder.php?config=${encodeURIComponent(item.path)}`;
                        }
                    };
                    
                    listEl.appendChild(row);
                });

            } catch(e) {
                console.error(e);
                listEl.innerHTML = '<div style="color:red; padding:1rem;">Error loading files</div>';
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
