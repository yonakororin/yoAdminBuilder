<?php require_once 'auth.php'; ?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>yoAdmin Viewer</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../shared/theme.css">
    <link rel="stylesheet" href="style.css">
    <style>
        /* Viewer overrides - hide edit controls */
        .btn-add, .add-sub, .icon-btn, .toolbox, .item-header, .resize-handle { display: none !important; }
        .sidebar { min-width: 220px !important; }
        /* Hide file controls and save button in footer, but keep footer itself for theme/logout */
        .file-controls, #save-btn { display: none !important; }
        .sidebar-footer { display: block; border-top: none; }
        .grid-item { 
            cursor: default; 
            background: transparent; 
            border: none;
        }
        .grid-item:hover { border-color: transparent; box-shadow: none; }
        .item-content { padding: 0; }
        .grid { background: none !important; border: none !important; }
        .grid-container { background: var(--bg) !important; }
    </style>
</head>
<body>
    <div id="app">
        <aside class="sidebar">
            <div class="brand">
                <a href="index.php" style="color:inherit;text-decoration:none;"><i class="fa-solid fa-shapes"></i> yoAdmin</a>
            </div>
            <div id="menu-tree" class="menu-tree"></div>
            <div class="sidebar-footer">
                <!-- Help Button -->
                <div style="margin-top: 10px; text-align: center;">
                    <button onclick="openHelp()" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:0.8rem;text-decoration:underline;">
                        <i class="fa-regular fa-circle-question"></i> Help / Guide
                    </button>
                </div>
            </div>
        </aside>
        <main class="main">
            <header class="header">
                <div id="breadcrumbs" class="breadcrumbs">Select a submenu</div>
                <div class="user-menu">
                    <button class="user-menu-btn" id="user-menu-btn">
                        <i class="fa-solid fa-user-circle"></i>
                        <span><?= htmlspecialchars($_SESSION['user'] ?? 'User') ?></span>
                        <i class="fa-solid fa-chevron-down" style="font-size:0.6rem;"></i>
                    </button>
                    <div class="user-menu-dropdown" id="user-menu-dropdown">
                        <div class="user-menu-item theme-select">
                            <i class="fa-solid fa-palette"></i>
                            <span>Theme:</span>
                            <select id="theme-select" title="Theme">
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
                        <a href="logout.php" class="user-menu-item">
                            <i class="fa-solid fa-sign-out-alt"></i>
                            <span>Logout</span>
                        </a>
                    </div>
                </div>
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

    <!-- Help Modal -->
    <div id="help-modal" class="comp-modal-overlay">
        <div class="comp-modal-content" style="max-width:800px;width:90%;">
            <button class="comp-modal-close" onclick="closeModal('help-modal')">&times;</button>
            <div id="help-content" style="max-height:80vh;overflow-y:auto;line-height:1.6;">Loading guide...</div>
        </div>
    </div>

    <!-- Marked.js for MDS rendering -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

    <script>
        // Global helpers via window
        window.openModal = function(id) {
            const el = document.getElementById(id);
            if(el) el.style.display = 'flex';
        };
        window.closeModal = function(arg) {
            if (typeof arg === 'string') {
                const el = document.getElementById(arg);
                if(el) el.style.display = 'none';
            } else if (arg instanceof Element) {
                const overlay = arg.closest('.comp-modal-overlay');
                if(overlay) overlay.style.display = 'none';
            }
        };
        
        // Help function
        async function openHelp() {
            openModal('help-modal');
            const el = document.getElementById('help-content');
            try {
                const res = await fetch('GUIDE.md');
                if (!res.ok) throw new Error('Failed to load guide');
                const text = await res.text();
                el.innerHTML = marked.parse(text);
            } catch (e) {
                el.innerHTML = '<p style="color:red">Error loading guide: ' + e.message + '</p>';
            }
        }

        // yoTable API - for dynamic table manipulation
        window.yoTable = {
            _state: {}, // { tableId: { data: [], page: 1, pageSize: 10, columns: [] } }
            
            _getState(tableId) {
                if (!this._state[tableId]) {
                    const el = document.getElementById(tableId);
                    this._state[tableId] = {
                        data: [],
                        page: 1,
                        pageSize: parseInt(el?.dataset.pagesize) || 10,
                        columns: JSON.parse(el?.dataset.columns || '[]')
                    };
                }
                return this._state[tableId];
            },
            
            setData(tableId, data) {
                const st = this._getState(tableId);
                st.data = Array.isArray(data) ? data : [];
                st.page = 1;
                this.refresh(tableId);
            },
            
            setColumns(tableId, columns) {
                const st = this._getState(tableId);
                st.columns = Array.isArray(columns) ? columns : [];
                const el = document.getElementById(tableId);
                if (el) {
                    const thead = el.querySelector('thead tr');
                    if (thead) {
                        thead.innerHTML = st.columns.map(c => `<th>${c}</th>`).join('');
                    }
                }
            },
            
            goToPage(tableId, page) {
                const st = this._getState(tableId);
                const maxPage = Math.ceil(st.data.length / st.pageSize) || 1;
                st.page = Math.max(1, Math.min(page, maxPage));
                this.refresh(tableId);
            },
            
            prevPage(tableId) {
                const st = this._getState(tableId);
                this.goToPage(tableId, st.page - 1);
            },
            
            nextPage(tableId) {
                const st = this._getState(tableId);
                this.goToPage(tableId, st.page + 1);
            },
            
            // Get row data by index (global index, not page index)
            getRowData(tableId, index) {
                const st = this._getState(tableId);
                return st.data[index] ?? null;
            },
            
            // Get all data
            getData(tableId) {
                const st = this._getState(tableId);
                return st.data;
            },
            
            // Set action column with buttons
            // buttons: [{ label: 'Edit', style: 'info', action: 'edit' }, ...]
            setActionColumn(tableId, columnName, buttons) {
                const st = this._getState(tableId);
                st.actionColumn = { name: columnName, buttons: buttons };
                
                // Add column if not exists
                if (!st.columns.includes(columnName)) {
                    st.columns.push(columnName);
                    // Update header
                    const el = document.getElementById(tableId);
                    if (el) {
                        const thead = el.querySelector('thead tr');
                        if (thead) {
                            thead.innerHTML = st.columns.map(c => `<th>${c}</th>`).join('');
                        }
                    }
                }
                this.refresh(tableId);
            },
            
            // Set row action handler
            // handler: function(action, rowData, rowIndex)
            onRowAction(tableId, handler) {
                const st = this._getState(tableId);
                st.actionHandler = handler;
            },
            
            // Internal: Handle action button click
            _handleAction(tableId, action, globalIndex) {
                const st = this._getState(tableId);
                const rowData = st.data[globalIndex];
                if (st.actionHandler) {
                    st.actionHandler(action, rowData, globalIndex);
                }
            },
            
            refresh(tableId) {
                const st = this._getState(tableId);
                const el = document.getElementById(tableId);
                if (!el) return;
                
                const tbody = el.querySelector('tbody');
                const pageInfo = el.querySelector('.page-info');
                const maxPage = Math.ceil(st.data.length / st.pageSize) || 1;
                
                // Update page info
                if (pageInfo) {
                    pageInfo.textContent = `Page ${st.page} / ${maxPage}`;
                }
                
                // Render rows for current page
                const start = (st.page - 1) * st.pageSize;
                const end = start + st.pageSize;
                const pageData = st.data.slice(start, end);
                
                if (tbody) {
                    if (pageData.length === 0) {
                        const colCount = st.columns.length;
                        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;color:var(--text-muted);">No data</td></tr>`;
                    } else {
                        tbody.innerHTML = pageData.map((row, pageIdx) => {
                            const globalIndex = start + pageIdx;
                            const cells = st.columns.map(col => {
                                // Check if this is the action column
                                if (st.actionColumn && col === st.actionColumn.name) {
                                    const btns = st.actionColumn.buttons.map(btn => {
                                        const btnClass = btn.style ? `btn-${btn.style}` : '';
                                        return `<button class="comp-button ${btnClass}" style="padding:4px 8px;font-size:0.75rem;margin:0 2px;" onclick="yoTable._handleAction('${tableId}','${btn.action}',${globalIndex})">${btn.label}</button>`;
                                    }).join('');
                                    return `<td>${btns}</td>`;
                                }
                                // Regular cell
                                const val = Array.isArray(row) ? row[st.columns.indexOf(col)] : (row[col] ?? '');
                                return `<td>${val}</td>`;
                            }).join('');
                            return `<tr data-row-index="${globalIndex}">${cells}</tr>`;
                        }).join('');
                    }
                }
            }
        };

        // Viewer Mode - Read Only
        const state = { config: [], brandTitle: 'yoAdmin', selectedMenuId: null, selectedSubmenuId: null, activeTabId: null };

        async function init() {
            const file = new URLSearchParams(location.search).get('config') || localStorage.getItem('yoAdminTargetFile') || 'admin_config.json';
            try {
                const res = await fetch(`api.php?file=${file}`);
                if (res.ok) {
                    const data = await res.json();
                    // Support both old format (array) and new format (object with menus/brandTitle)
                    if (Array.isArray(data)) {
                        state.config = data;
                        state.brandTitle = 'yoAdmin';
                    } else {
                        state.config = data.menus || [];
                        state.brandTitle = data.brandTitle || 'yoAdmin';
                    }
                }
            } catch (e) { console.error(e); }
            
            // Update brand title
            const brandEl = document.querySelector('.brand a');
            if (brandEl) brandEl.innerHTML = `<i class="fa-solid fa-shapes"></i> ${state.brandTitle}`;
            
            renderSidebar();
        }

        function renderSidebar() {
            const el = document.getElementById('menu-tree');
            el.innerHTML = state.config.map(m => {
                const hasDirectTabs = m.tabs && m.tabs.length > 0 && (!m.submenus || m.submenus.length === 0);
                const isSelected = state.selectedMenuId === m.id && !state.selectedSubmenuId;
                const isExpanded = state.selectedMenuId === m.id;
                
                if (hasDirectTabs) {
                    return `
                        <div class="menu-item">
                            <div class="menu-header menu-direct ${isSelected ? 'active' : ''}" data-menu="${m.id}">
                                <span><i class="fa-solid fa-file-alt"></i> ${m.title}</span>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="menu-item">
                            <div class="menu-header menu-toggle" data-menu="${m.id}">
                                <div>
                                    <i class="fa-solid fa-chevron-right menu-chevron ${isExpanded ? 'expanded' : ''}" style="font-size:0.6rem;margin-right:5px;"></i>
                                    <span><i class="fa-solid fa-folder"></i> ${m.title}</span>
                                </div>
                            </div>
                            <div class="submenu-list" style="${isExpanded ? '' : 'display:none;'}">
                                ${(m.submenus || []).map(s => `<div class="submenu-item ${state.selectedSubmenuId === s.id ? 'active' : ''}" data-menu="${m.id}" data-sub="${s.id}">${s.title}</div>`).join('')}
                            </div>
                        </div>
                    `;
                }
            }).join('');

            // Click handler for direct menu
            el.querySelectorAll('.menu-direct').forEach(item => {
                item.onclick = () => {
                    state.selectedMenuId = item.dataset.menu;
                    state.selectedSubmenuId = null;
                    const menu = state.config.find(m => m.id === state.selectedMenuId);
                    if (menu?.tabs?.length) state.activeTabId = menu.tabs[0].id;
                    renderSidebar();
                    showWorkspace();
                };
            });

            el.querySelectorAll('.submenu-item').forEach(item => {
                item.onclick = () => {
                    state.selectedMenuId = item.dataset.menu;
                    state.selectedSubmenuId = item.dataset.sub;
                    const sub = getSubmenu();
                    if (sub?.tabs?.length) state.activeTabId = sub.tabs[0].id;
                    showWorkspace();
                };
            });

            // Click handler for menu toggle (expand/collapse) - accordion style
            el.querySelectorAll('.menu-toggle').forEach(item => {
                item.onclick = () => {
                    const menuItem = item.closest('.menu-item');
                    const submenuList = menuItem.querySelector('.submenu-list');
                    const chevron = item.querySelector('.menu-chevron');
                    const isHidden = submenuList?.style.display === 'none';
                    
                    // Accordion: collapse all other menus first
                    el.querySelectorAll('.menu-item').forEach(otherItem => {
                        if (otherItem !== menuItem) {
                            const otherList = otherItem.querySelector('.submenu-list');
                            const otherChevron = otherItem.querySelector('.menu-chevron');
                            if (otherList) otherList.style.display = 'none';
                            if (otherChevron) otherChevron.classList.remove('expanded');
                        }
                    });
                    
                    // Toggle clicked menu
                    if (submenuList) {
                        submenuList.style.display = isHidden ? 'block' : 'none';
                        if (chevron) chevron.classList.toggle('expanded', isHidden);
                    }
                };
            });
        }

        function getSubmenu() {
            const m = state.config.find(x => x.id === state.selectedMenuId);
            if (!state.selectedSubmenuId) return null;
            return m?.submenus?.find(x => x.id === state.selectedSubmenuId);
        }
        
        function getTabs() {
            const menu = state.config.find(m => m.id === state.selectedMenuId);
            if (!state.selectedSubmenuId && menu?.tabs) return menu.tabs;
            const sub = getSubmenu();
            return sub?.tabs || [];
        }

        function showWorkspace() {
            document.getElementById('empty-state').classList.add('hidden');
            document.getElementById('workspace').classList.remove('hidden');
            const m = state.config.find(x => x.id === state.selectedMenuId);
            const s = getSubmenu();
            document.getElementById('breadcrumbs').textContent = s ? `${m?.title} > ${s?.title}` : m?.title || '';
            renderTabs();
            renderGrid();
        }

        function renderTabs() {
            const tabs = getTabs();
            const el = document.getElementById('tabs');
            el.innerHTML = tabs.map(t => `<div class="tab ${state.activeTabId === t.id ? 'active' : ''}" data-id="${t.id}">${t.title}</div>`).join('');
            el.querySelectorAll('.tab').forEach(t => {
                t.onclick = () => { state.activeTabId = t.dataset.id; renderTabs(); renderGrid(); };
            });
        }

        function renderGrid() {
            const tabs = getTabs();
            const t = tabs.find(x => x.id === state.activeTabId);
            const g = document.getElementById('grid');
            g.innerHTML = (t?.components || []).map(c => {
                // For modal/loading, putting ID on wrapper causes collision with overlay ID.
                const isOverlay = c.type === 'modal' || c.type === 'loading';
                const customId = (c.customId && !isOverlay) ? `id="${c.customId}"` : '';
                const customClass = c.customClass ? c.customClass : '';
                return `
                <div class="grid-item ${customClass}" ${customId} style="grid-column:${(c.x||0)+1}/span ${c.w||4};grid-row:${(c.y||0)+1}/span ${c.h||2}">
                    <div class="item-content">${getComponentContent(c)}</div>
                </div>
            `}).join('');
            
            // Load HTML files and execute scripts
            loadHtmlFiles(g);
            executeScripts(g);
        }
        
        async function loadHtmlFiles(container) {
            const fileElements = container.querySelectorAll('.comp-html-file[data-file]');
            for (const el of fileElements) {
                const filePath = el.dataset.file;
                try {
                    const res = await fetch(`api.php?action=readfile&path=${encodeURIComponent(filePath)}`);
                    if (res.ok) {
                        const content = await res.text();
                        el.innerHTML = content;
                        // Execute any scripts in the loaded content
                        executeScripts(el);
                    } else {
                        el.innerHTML = `<span style="color:red;">Error loading file</span>`;
                    }
                } catch (e) {
                    el.innerHTML = `<span style="color:red;">Load error: ${e.message}</span>`;
                }
            }
        }
        
        function executeScripts(container) {
            const scripts = container.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                if (oldScript.src) {
                    newScript.src = oldScript.src;
                } else {
                    newScript.textContent = oldScript.textContent;
                }
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
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
                    const btnStyle = comp.buttonStyle || 'normal'; 
                    const disabledAttr = btnStyle === 'disabled' ? 'disabled' : '';
                    const btnClass = btnStyle !== 'normal' ? `btn-${btnStyle}` : '';
                    const onClickAttr = comp.onClick ? `onclick="${comp.onClick.replace(/"/g, '&quot;')}"` : '';
                    return `<button class="comp-button ${btnClass}" ${disabledAttr} ${onClickAttr}>${label}</button>`;
                case 'datepicker':
                    const inputType = comp.includeTime ? 'datetime-local' : 'date';
                    return pos === 'right'
                        ? `<label class="comp-datepicker ${flexClass}"><input type="${inputType}"><span>${label}</span></label>`
                        : `<label class="comp-datepicker ${flexClass}"><span>${label}</span><input type="${inputType}"></label>`;
                case 'form':
                    return `<div class="comp-form"><span>${label}</span></div>`;
                case 'html':
                    if (comp.content) {
                        return `<div class="comp-html">${comp.content}</div>`;
                    } else if (comp.filePath) {
                        // Return container with data attribute for async file loading
                        return `<div class="comp-html comp-html-file" data-file="${comp.filePath}"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
                    } else {
                        return `<div class="comp-html"></div>`;
                    }
                case 'checklist': {
                    const items = comp.items || ['Option 1', 'Option 2', 'Option 3'];
                    const mode = comp.checklistMode || 'multi'; 
                    const inputType = mode === 'single' ? 'radio' : 'checkbox';
                    const nameAttr = mode === 'single' ? `name="chk-${comp.customId || Math.random().toString(36).substr(2, 9)}"` : ''; 
                    
                    let listHtml = items.map((item, idx) => `
                        <label class="checklist-item" style="display:flex;align-items:center;gap:6px;margin-bottom:4px;cursor:pointer;">
                            <input type="${inputType}" ${nameAttr} id="${comp.customId || 'chk'}-${idx}" style="margin:0;width:auto;cursor:pointer;">
                            <span>${item}</span>
                        </label>
                    `).join('');
                    
                    return `
                        <div class="comp-checklist-container">
                            <div class="comp-label" style="font-weight:500;margin-bottom:8px;">${label}</div>
                            <div class="comp-checklist-items" style="display:flex;flex-direction:column;">${listHtml}</div>
                        </div>
                    `;
                }
                case 'modal':
                    const footerBtns = (comp.modalButtons || []).map(b => {
                        const style = b.style || 'normal';
                        const btnClass = style !== 'normal' ? `btn-${style}` : '';
                        const onClick = b.onClick ? `onclick="${b.onClick.replace(/"/g, '&quot;')}"` : '';
                        return `<button class="comp-button ${btnClass}" ${onClick}>${b.label}</button>`;
                    }).join('');
                    const footerHtml = footerBtns ? `<div class="comp-modal-footer">${footerBtns}</div>` : '';

                    return `
                        <div id="${comp.customId || ''}" class="comp-modal-overlay">
                            <div class="comp-modal-content">
                                <button class="comp-modal-close" onclick="this.closest('.comp-modal-overlay').style.display='none'">&times;</button>
                                ${comp.content || ''}
                                ${footerHtml}
                            </div>
                        </div>
                    `;
                case 'loading':
                    return `
                        <div id="${comp.customId || ''}" class="comp-loading-overlay">
                            <i class="fa-solid fa-spinner fa-spin"></i>
                            <div class="comp-loading-text">${comp.loadingText || 'Loading...'}</div>
                        </div>
                    `;
                case 'table': {
                    const tableId = comp.customId || 'table-' + comp.id;
                    const columns = comp.columns || ['Column 1', 'Column 2'];
                    const pageSize = comp.pageSize || 10;
                    const headerRow = columns.map(c => `<th>${c}</th>`).join('');
                    
                    return `
                        <div id="${tableId}" class="comp-table" data-pagesize="${pageSize}" data-columns='${JSON.stringify(columns)}'>
                            <table>
                                <thead><tr>${headerRow}</tr></thead>
                                <tbody></tbody>
                            </table>
                            <div class="comp-table-pagination">
                                <button onclick="yoTable.prevPage('${tableId}')">&laquo; Prev</button>
                                <span class="page-info">Page 1</span>
                                <button onclick="yoTable.nextPage('${tableId}')">Next &raquo;</button>
                            </div>
                        </div>
                    `;
                }
                default:
                    return `<span>${label}</span>`;
            }
        }

        init();
    </script>
    <script>window.currentUser = "<?= isset($_SESSION['user']) ? htmlspecialchars($_SESSION['user']) : '' ?>";</script>
    <script>
        // User menu dropdown toggle
        document.getElementById('user-menu-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('user-menu-dropdown')?.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            document.getElementById('user-menu-dropdown')?.classList.remove('show');
        });
        
        // Prevent dropdown from closing when clicking inside
        document.getElementById('user-menu-dropdown')?.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    </script>
    <script src="../shared/theme.js"></script>
</body>
</html>
