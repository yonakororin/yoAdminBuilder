<?php require_once 'auth.php'; ?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>yoAdmin Viewer</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
    <style>
        /* Viewer overrides - hide edit controls */
        .btn-add, .add-sub, .icon-btn, .toolbox, .item-header, .resize-handle { display: none !important; }
        .sidebar-footer { display: none; }
        .grid-item { cursor: default; }
        .grid-item:hover { border-color: var(--border); box-shadow: none; }
    </style>
</head>
<body>
    <div id="app">
        <aside class="sidebar">
            <div class="brand"><i class="fa-solid fa-shapes"></i> yoAdmin</div>
            <div id="menu-tree" class="menu-tree"></div>
        </aside>
        <main class="main">
            <header class="header">
                <div id="breadcrumbs" class="breadcrumbs">Select a submenu</div>
            </header>
            <div id="empty-state" class="empty-state"><p>Select a submenu to view.</p></div>
            <div id="workspace" class="workspace hidden">
                <div class="tabs-bar">
                    <div id="tabs" class="tabs"></div>
                </div>
                <div class="grid-container">
                    <div id="grid" class="grid"></div>
                </div>
            </div>
        </main>
    </div>

    <script>
        // Viewer Mode - Read Only
        const state = { config: [], selectedMenuId: null, selectedSubmenuId: null, activeTabId: null };

        async function init() {
            const file = new URLSearchParams(location.search).get('config') || localStorage.getItem('yoAdminTargetFile') || 'admin_config.json';
            try {
                const res = await fetch(`api.php?file=${file}`);
                if (res.ok) state.config = await res.json();
            } catch (e) { console.error(e); }
            renderSidebar();
        }

        function renderSidebar() {
            const el = document.getElementById('menu-tree');
            el.innerHTML = state.config.map(m => `
                <div class="menu-item">
                    <div class="menu-header"><span><i class="fa-solid fa-folder"></i> ${m.title}</span></div>
                    <div class="submenu-list">
                        ${(m.submenus || []).map(s => `<div class="submenu-item ${state.selectedSubmenuId === s.id ? 'active' : ''}" data-menu="${m.id}" data-sub="${s.id}">${s.title}</div>`).join('')}
                    </div>
                </div>
            `).join('');

            el.querySelectorAll('.submenu-item').forEach(item => {
                item.onclick = () => {
                    state.selectedMenuId = item.dataset.menu;
                    state.selectedSubmenuId = item.dataset.sub;
                    const sub = getSubmenu();
                    if (sub?.tabs?.length) state.activeTabId = sub.tabs[0].id;
                    showWorkspace();
                };
            });
        }

        function getSubmenu() {
            const m = state.config.find(x => x.id === state.selectedMenuId);
            return m?.submenus?.find(x => x.id === state.selectedSubmenuId);
        }

        function showWorkspace() {
            document.getElementById('empty-state').classList.add('hidden');
            document.getElementById('workspace').classList.remove('hidden');
            const m = state.config.find(x => x.id === state.selectedMenuId);
            const s = getSubmenu();
            document.getElementById('breadcrumbs').textContent = `${m?.title} > ${s?.title}`;
            renderTabs();
            renderGrid();
        }

        function renderTabs() {
            const s = getSubmenu();
            const el = document.getElementById('tabs');
            el.innerHTML = (s?.tabs || []).map(t => `<div class="tab ${state.activeTabId === t.id ? 'active' : ''}" data-id="${t.id}">${t.title}</div>`).join('');
            el.querySelectorAll('.tab').forEach(t => {
                t.onclick = () => { state.activeTabId = t.dataset.id; renderTabs(); renderGrid(); };
            });
        }

        function renderGrid() {
            const s = getSubmenu();
            const t = s?.tabs?.find(x => x.id === state.activeTabId);
            const g = document.getElementById('grid');
            g.innerHTML = (t?.components || []).map(c => `
                <div class="grid-item" style="grid-column:${(c.x||0)+1}/span ${c.w||4};grid-row:${(c.y||0)+1}/span ${c.h||2}">
                    <div class="item-content">${getComponentContent(c)}</div>
                </div>
            `).join('');
        }
        
        function getComponentContent(comp) {
            const label = comp.label || 'Label';
            const pos = comp.labelPosition || 'left';
            const flexClass = pos === 'right' ? 'label-right' : 'label-left';
            
            switch(comp.type) {
                case 'checkbox':
                    return pos === 'right' 
                        ? `<label class="comp-checkbox ${flexClass}"><input type="checkbox"><span>${label}</span></label>`
                        : `<label class="comp-checkbox ${flexClass}"><span>${label}</span><input type="checkbox"></label>`;
                case 'toggle':
                    return pos === 'right'
                        ? `<label class="comp-toggle ${flexClass}"><input type="checkbox" class="toggle-input"><span class="toggle-slider"></span><span>${label}</span></label>`
                        : `<label class="comp-toggle ${flexClass}"><span>${label}</span><input type="checkbox" class="toggle-input"><span class="toggle-slider"></span></label>`;
                case 'input':
                    return pos === 'right'
                        ? `<label class="comp-input ${flexClass}"><input type="text" placeholder="..."><span>${label}</span></label>`
                        : `<label class="comp-input ${flexClass}"><span>${label}</span><input type="text" placeholder="..."></label>`;
                case 'button':
                    return `<button class="comp-button">${label}</button>`;
                case 'datepicker':
                    const inputType = comp.includeTime ? 'datetime-local' : 'date';
                    return pos === 'right'
                        ? `<label class="comp-datepicker ${flexClass}"><input type="${inputType}"><span>${label}</span></label>`
                        : `<label class="comp-datepicker ${flexClass}"><span>${label}</span><input type="${inputType}"></label>`;
                case 'form':
                    return `<div class="comp-form"><span>${label}</span></div>`;
                case 'html':
                    return `<div class="comp-html">${comp.content || ''}</div>`;
                default:
                    return `<span>${label}</span>`;
            }
        }

        init();
    </script>
</body>
</html>
