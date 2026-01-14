<?php
session_start();

// --- Configuration ---
// Adjust this to point to your yoSSO directory relative to this folder
// If you are at http://localhost/tools/my_tool/
// And yoSSO is at http://localhost/tools/yoSSO/
// Then $sso_relative_path = '../../yoSSO'; or similar logic depending on filesystem
// Here we default to assuming a standard structure or we can provide a manual override
$sso_relative_path = '../yoSSO'; 

// Override via env var if needed or manual edit
if (getenv('YO_SSO_PATH')) {
    $sso_relative_path = getenv('YO_SSO_PATH');
}

// ---------------------
// Auth Logic (Inlined)
// ---------------------

function get_current_base_url() {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'];
    $path = dirname($_SERVER['SCRIPT_NAME']);
    $path = str_replace('\\', '/', $path);
    $path = rtrim($path, '/');
    return $protocol . $host . $path;
}

$base_url = get_current_base_url();
$sso_url = $sso_relative_path; // For HTTP redirect
$sso_disk_path = __DIR__ . '/' . $sso_relative_path; // For file check

$codes_file = $sso_disk_path . '/data/codes.json';

// 1. Check if logged in
if (!isset($_SESSION['user'])) {
    
    // 2. Check for Code
    if (isset($_GET['code'])) {
        $code = $_GET['code'];
        
        if (file_exists($codes_file)) {
            $codes = json_decode(file_get_contents($codes_file), true);
            if (isset($codes[$code])) {
                $data = $codes[$code];
                if ($data['expires_at'] > time()) {
                    $_SESSION['user'] = $data['username'];
                    unset($codes[$code]);
                    file_put_contents($codes_file, json_encode($codes));
                    
                    // Redirect clean
                    $parts = parse_url(get_current_base_url() . '/' . basename($_SERVER['PHP_SELF'])); // robust self-redirect
                     // Actually just reload current page without query
                    header("Location: " . $parts['path']);
                    exit;
                } else {
                     die("Code expired. <a href='$sso_url'>Login again</a>");
                }
            } else {
                 die("Invalid code. <a href='$sso_url'>Login again</a>");
            }
        } else {
            // Fallback: If local validation impossible (e.g. diff server), we can't easily valid.
            // But user requirement implies same server file access.
            die("Error: SSO Codes file not accessible at $codes_file. Check configuration in index.php.");
        }
    }

    // 3. Redirect to login
    $redirect_uri = urlencode($base_url . '/' . basename($_SERVER['PHP_SELF']));
    header("Location: $sso_url?redirect_uri=$redirect_uri");
    exit;
}

// ---------------------
// Data Loading
// ---------------------
$json_data = '[]';
$config_files = glob("*.json");
// Prefer a file passed in GET, or admin_config.json, or the first json found
$target_file = $_GET['config'] ?? 'admin_config.json';
if (!file_exists(__DIR__ . '/' . $target_file) && count($config_files) > 0) {
    // If default not found, pick first available
    $target_file = $config_files[0];
}

if (file_exists(__DIR__ . '/' . $target_file)) {
    $json_data = file_get_contents(__DIR__ . '/' . $target_file);
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>yoAdmin Viewer</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        /* INLINED STYLES */
        :root {
            --bg-dark: #0f172a;
            --bg-darker: #020617;
            --bg-card: #1e293b;
            --bg-hover: #334155;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent: #3b82f6;
            --accent-hover: #2563eb;
            --border: #334155;
            --danger: #ef4444;
            --success: #22c55e;
            
            --font-sans: 'Inter', sans-serif;
            --anim-fast: 0.2s ease;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background-color: var(--bg-dark);
            color: var(--text-primary);
            font-family: var(--font-sans);
            height: 100vh;
            overflow: hidden;
        }

        #app {
            display: flex;
            height: 100%;
        }

        /* Sidebar */
        .sidebar {
            width: 260px;
            background-color: var(--bg-darker);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            padding: 1rem;
        }

        .brand {
            margin-bottom: 2rem;
        }

        .brand h1 {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text-primary);
        }

        .brand span {
            color: var(--accent);
        }

        .menu-list {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .menu-item {
            display: flex;
            flex-direction: column;
        }

        .menu-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem;
            border-radius: 6px;
            cursor: pointer;
            transition: background var(--anim-fast);
            color: var(--text-secondary);
        }

        .menu-header:hover, .menu-header.active {
            background-color: var(--bg-hover);
            color: var(--text-primary);
        }

        .submenu-list {
            margin-left: 1rem;
            border-left: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            margin-top: 0.25rem;
            margin-bottom: 0.25rem;
        }

        .submenu-item {
            padding: 0.5rem 1rem;
            font-size: 0.9rem;
            color: var(--text-secondary);
            cursor: pointer;
            border-radius: 4px;
            transition: color var(--anim-fast);
        }

        .submenu-item:hover, .submenu-item.active {
            color: var(--accent);
            background-color: rgba(59, 130, 246, 0.1);
        }

        /* Main Content */
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            background-color: var(--bg-dark);
        }

        .top-bar {
            height: 60px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 1.5rem;
            background-color: var(--bg-dark);
        }

        .breadcrumbs {
            color: var(--text-secondary);
            font-size: 0.9rem;
        }

        /* Workspace */
        .workspace {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 2rem; 
            overflow-y: auto;
        }

        .hidden {
            display: none !important;
        }

        .tabs-container {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            border-bottom: 1px solid var(--border);
        }

        .tabs-header {
            display: flex;
            gap: 2px;
        }

        .tab {
            padding: 0.75rem 1.5rem;
            background-color: transparent;
            border: 1px solid transparent;
            border-bottom: none;
            color: var(--text-secondary);
            cursor: pointer;
            border-radius: 6px 6px 0 0;
            transition: all var(--anim-fast);
        }

        .tab:hover {
            color: var(--text-primary);
            background-color: var(--bg-hover);
        }

        .tab.active {
            color: var(--accent);
            background-color: var(--bg-card);
            border-color: var(--border);
            border-bottom-color: var(--bg-card);
            margin-bottom: -1px;
        }

        /* Tab Content Areas */
        .tab-content {
            flex: 1;
            background-color: var(--bg-card);
            border-radius: 8px;
            padding: 1.5rem;
            border: 1px solid var(--border);
            min-height: 400px;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            margin-top: 1rem;
        }

        /* Components */
        .component-wrapper-static {
           margin-bottom: 1rem;
        }
        
        .form-group { margin-bottom: 0.5rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; color: var(--text-secondary); font-size: 0.9rem; }
        .form-input { width: 100%; padding: 0.75rem; background-color: var(--bg-dark); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); }
        .btn-primary { background-color: var(--accent); color: white; border: none; padding: 0.75rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .btn-primary:hover { background-color: var(--accent-hover); }

        .empty-state {
            display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);
        }
    </style>
</head>
<body>
    <div id="app">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="brand">
                <h1>yoAdmin<span>Viewer</span></h1>
            </div>
            
            <div class="menu-list" id="menu-list">
                <!-- Dynamic Menus -->
            </div>
            
            <div style="margin-top:auto; padding-top:1rem; border-top:1px solid var(--border);">
                 <div style="font-size:0.8rem; color:var(--text-secondary);">User: <?= htmlspecialchars($_SESSION['user']) ?></div>
                 <a href="<?= htmlspecialchars($sso_url) ?>/change_password.php?redirect_uri=<?= urlencode($base_url . '/') ?>" style="font-size:0.8rem; color:var(--accent); text-decoration:none; display:block; margin-top:5px;">Change Password</a>
                 <a href="<?= htmlspecialchars($sso_url) ?>/index.php?logout=1" style="font-size:0.8rem; color:var(--danger); text-decoration:none; display:block; margin-top:5px;">Logout</a>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
            <header class="top-bar">
                <div id="breadcrumbs" class="breadcrumbs">Select a menu...</div>
            </header>

            <div id="workspace" class="workspace hidden">
                <!-- Tabs -->
                <div class="tabs-container">
                    <div class="tabs-header" id="tabs-header"></div>
                </div>

                <!-- Tab Content -->
                <div class="tab-content" id="active-tab-content"></div>
            </div>
            
            <div id="empty-state" class="empty-state">
                <p>Welcome to yoAdmin.</p>
            </div>
        </main>
    </div>

    <script>
        // INLINED DATA
        const PRELOADED_DATA = <?= $json_data ?>;
    
        // INLINED RENDER LOGIC
        
        function renderSidebar(menuListEl, menus, activeState, callbacks) {
            if (!menuListEl) return;
            menuListEl.innerHTML = '';

            menus.forEach(menu => {
                const menuEl = document.createElement('div');
                menuEl.className = 'menu-item';

                // Menu Header
                const header = document.createElement('div');
                const isActive = activeState.selectedMenuId === menu.id;
                header.className = `menu-header ${isActive ? 'active' : ''}`;
                header.innerHTML = `<span>${menu.title}</span>`;
                header.onclick = () => callbacks.onSelectMenu(menu.id);

                // Submenus
                const subList = document.createElement('div');
                subList.className = 'submenu-list';

                if (menu.submenus && menu.submenus.length > 0) {
                    menu.submenus.forEach(sub => {
                        const subEl = document.createElement('div');
                        const isSubActive = activeState.selectedSubmenuId === sub.id;
                        subEl.className = `submenu-item ${isSubActive ? 'active' : ''}`;
                        subEl.innerText = sub.title;
                        subEl.onclick = (e) => {
                            e.stopPropagation();
                            callbacks.onSelectSubmenu(menu.id, sub.id);
                        };
                        subList.appendChild(subEl);
                    });
                }

                menuEl.appendChild(header);
                menuEl.appendChild(subList);
                menuListEl.appendChild(menuEl);
            });
        }

        function renderTabs(tabsHeaderEl, tabs, activeTabId, callbacks) {
            if (!tabsHeaderEl) return;
            tabsHeaderEl.innerHTML = '';
            if (!tabs) return;

            tabs.forEach(tab => {
                const tabEl = document.createElement('button');
                tabEl.className = `tab ${activeTabId === tab.id ? 'active' : ''}`;
                tabEl.innerText = tab.title;
                tabEl.onclick = () => callbacks.onSelectTab(tab.id);
                tabsHeaderEl.appendChild(tabEl);
            });
        }

        function renderComponent(comp, index, callbacks, isBuilder = false) {
            const wrapper = document.createElement('div');
            wrapper.className = isBuilder ? 'component-wrapper' : 'component-wrapper-static';

            // Content
            if (comp.type === 'input') {
                const id = `inp-${Date.now()}-${index}`;
                wrapper.innerHTML += `
                    <div class="form-group">
                        <label for="${id}">${comp.label}</label>
                        <input id="${id}" type="text" class="form-input" placeholder="User input...">
                    </div>
                `;
            } else if (comp.type === 'button') {
                wrapper.innerHTML += `
                    <div class="form-group" style="padding-top:1rem;">
                        <button class="btn-primary" style="width:auto">${comp.label}</button>
                    </div>
                `;
            } else if (comp.type === 'html') {
                const container = document.createElement('div');
                container.innerHTML = comp.code;
                if (comp.script) {
                    try {
                        const fn = new Function(comp.script);
                        setTimeout(() => fn(), 0);
                    } catch (e) {
                        console.error("Custom Script Error", e);
                    }
                }
                wrapper.appendChild(container);
            }
            return wrapper;
        }

        // APP LOGIC
        const state = { menus: PRELOADED_DATA };
        let selectedMenuId = null;
        let selectedSubmenuId = null;
        let activeTabId = null;

        function render() {
            renderSidebar(document.getElementById('menu-list'), state.menus, {
                selectedMenuId,
                selectedSubmenuId
            }, {
                onSelectMenu: (id) => { selectedMenuId = id; render(); },
                onSelectSubmenu: (pid, id) => {
                    selectedMenuId = pid;
                    selectedSubmenuId = id;
                    const menu = state.menus.find(m => m.id === pid);
                    const sub = menu.submenus.find(s => s.id === id);
                    if (sub && sub.tabs.length > 0) activeTabId = sub.tabs[0].id;
                    render();
                }
            });

            const workspace = document.getElementById('workspace');
            const empty = document.getElementById('empty-state');
            const bread = document.getElementById('breadcrumbs');
            const tabsHeader = document.getElementById('tabs-header');
            const tabContent = document.getElementById('active-tab-content');

            if (!selectedSubmenuId) {
                workspace.classList.add('hidden');
                empty.classList.remove('hidden');
                return;
            }

            const menu = state.menus.find(m => m.id === selectedMenuId);
            const sub = menu.submenus.find(s => s.id === selectedSubmenuId);

            workspace.classList.remove('hidden');
            empty.classList.add('hidden');
            bread.innerText = `${menu.title} > ${sub.title}`;

            renderTabs(tabsHeader, sub.tabs, activeTabId, {
                onSelectTab: (id) => { activeTabId = id; render(); }
            });

            tabContent.innerHTML = '';
            const tab = sub.tabs.find(t => t.id === activeTabId);
            if (tab) {
                tab.components.forEach((comp, idx) => {
                    const el = renderComponent(comp, idx, {}, false);
                    tabContent.appendChild(el);
                });
            }
        }

        // Init
        if (!Array.isArray(state.menus)) {
            console.error("Invalid JSON data loaded");
            state.menus = [];
        }
        render();

    </script>
</body>
</html>
