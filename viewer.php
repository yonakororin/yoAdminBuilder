<?php require_once 'auth.php'; ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>yoAdmin Viewer</title>
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        /* Viewer specific overrides */
        .workspace { padding: 2rem; }
        .component-wrapper-static { margin-bottom: 1rem; }
        .toolbox, #add-menu-btn, #add-tab-btn, .actions button:not(#config-settings-btn) { display: none !important; }
        /* Hide edit/add controls */
        .component-controls { display: none !important; }
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
        </aside>

        <!-- Main Content -->
        <main class="main-content">
            <header class="top-bar">
                <div id="breadcrumbs" class="breadcrumbs">Select a menu...</div>
                <!-- Optional: Viewer settings? -->
            </header>

            <div id="workspace" class="workspace hidden">
                <!-- Tabs -->
                <div class="tabs-container">
                    <div class="tabs-header" id="tabs-header">
                        <!-- Dynamic Tabs -->
                    </div>
                </div>

                <!-- Tab Content -->
                <div class="tab-content" id="active-tab-content" style="border:none; padding:0;">
                    <!-- Components render here -->
                </div>
            </div>
            
            <div id="empty-state" class="empty-state">
                <p>Welcome to yoAdmin.</p>
            </div>
        </main>
    </div>

    <!-- Simplest Viewer Script -->
    <script type="module">
        import { renderSidebar, renderTabs, renderComponent } from './render.js';

        const state = { menus: [] };
        let selectedMenuId = null;
        let selectedSubmenuId = null;
        let activeTabId = null;

        // Configuration
        // In a real separate deploy, this might be hardcoded or injected
        const CONFIG_FILE = 'admin_config.json'; 

        async function init() {
            try {
                // Determine file from query param or default
                const urlParams = new URLSearchParams(window.location.search);
                const file = urlParams.get('config') || localStorage.getItem('yoAdminTargetFile') || CONFIG_FILE;

                const response = await fetch(`api.php?file=${file}`);
                if (response.ok) {
                    state.menus = await response.json();
                }
            } catch (e) {
                console.error("Failed to load config", e);
            }
            render();
        }

        function render() {
            renderSidebar(document.getElementById('menu-list'), state.menus, {
                selectedMenuId,
                selectedSubmenuId
            }, {
                onSelectMenu: (id) => { selectedMenuId = id; render(); },
                onSelectSubmenu: (pid, id) => {
                    selectedMenuId = pid;
                    selectedSubmenuId = id;
                    // Auto select tab
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
                    const el = renderComponent(comp, idx, {}, false); // false = viewer mode
                    tabContent.appendChild(el);
                });
            }
        }

        init();
    </script>
</body>
</html>
