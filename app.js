// ============================================================
// yoAdmin Builder - App.js (v3)
// シンプルな12カラムCSS Gridベースの実装
// 外部ライブラリ不使用
// ============================================================

// --- State ---
const state = {
    config: [],
    brandTitle: 'yoAdmin',
    selectedMenuId: null,
    selectedSubmenuId: null,
    activeTabId: null,
    targetFile: 'admin_config.json',
    globalHeader: { components: [] },
    globalFooter: { components: [] }
};

// --- DOM Elements ---
const menuTreeEl = document.getElementById('menu-tree');
const tabsEl = document.getElementById('tabs');
const gridEl = document.getElementById('grid');
const breadcrumbsEl = document.getElementById('breadcrumbs');
const emptyStateEl = document.getElementById('empty-state');
const workspaceEl = document.getElementById('workspace');
const fileInputEl = document.getElementById('file-input');

// Modal
const modalEl = document.getElementById('modal');
const modalTitleEl = document.getElementById('modal-title');
const modalBodyEl = document.getElementById('modal-body');

// --- Grid Drag/Resize State ---
let dragState = null;
let currentEditComp = null; // For modal editing
let codeMirrorInstance = null; // CodeMirror editor instance
let pendingFilePath = null; // Stores file path selected from browser

// ============================================================
// INITIALIZATION
// ============================================================
async function init() {
    await initLoad();
    renderSidebar();
    setupEventListeners();
}


// Core load logic
async function loadConfigFile(filename) {
    console.log('Loading config:', filename);
    state.targetFile = filename;
    fileInputEl.value = filename;
    localStorage.setItem('yoAdminTargetFile', filename);

    // Update URL without reload
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('config', filename);
    window.history.pushState({ path: newUrl.href }, '', newUrl.href);

    try {
        const res = await fetch(`api.php?file=${encodeURIComponent(filename)}`);
        if (res.ok) {
            const data = await res.json();
            // Support both old format (array) and new format (object with menus/brandTitle)
            if (Array.isArray(data)) {
                state.config = data;
                state.brandTitle = 'yoAdmin';
                state.globalHeader = { components: [] };
                state.globalFooter = { components: [] };
            } else {
                state.config = data.menus || [];
                state.brandTitle = data.brandTitle || 'yoAdmin';
                state.globalHeader = data.globalHeader || { components: [] };
                state.globalFooter = data.globalFooter || { components: [] };
            }
        } else {
            console.warn('File not found or empty, starting with empty config');
            state.config = [];
            state.brandTitle = 'yoAdmin';
            state.globalHeader = { components: [] };
            state.globalFooter = { components: [] };
        }
    } catch (e) {
        console.error('Load failed:', e);
        state.config = [];
        state.brandTitle = 'yoAdmin';
    }

    // Update brand text
    const brandTextEl = document.getElementById('brand-text');
    if (brandTextEl) brandTextEl.textContent = state.brandTitle;

    // Reset selection
    state.selectedMenuId = null;
    state.selectedSubmenuId = null;
    state.activeTabId = null;

    renderSidebar();

    // Auto-expand global header if it has components
    if (state.globalHeader?.components?.length > 0) {
        const headerEditor = document.getElementById('global-header-editor');
        const headerToggle = document.getElementById('toggle-global-header');
        if (headerEditor && headerToggle) {
            headerEditor.classList.remove('hidden');
            headerToggle.classList.add('active');
        }
    }

    renderGlobalAreas();
    // Reset UI to empty state
    emptyStateEl.classList.remove('hidden');
    workspaceEl.classList.add('hidden');
    // Hide tools menu when exiting workspace
    const toolsMenu = document.getElementById('tools-menu');
    if (toolsMenu) toolsMenu.classList.add('hidden');
    breadcrumbsEl.textContent = 'Select a submenu';
}

async function initLoad() {
    // 1. URL Param
    const urlParams = new URLSearchParams(window.location.search);
    const urlConfig = urlParams.get('config');

    // 2. Input Value (default) or LocalStorage
    // Note: On fresh load, input value is 'admin_config.json' from HTML. 
    // If URL is present, use it. Else check storage. Else default.
    const file = urlConfig || localStorage.getItem('yoAdminTargetFile') || fileInputEl.value || 'admin_config.json';

    await loadConfigFile(file);
}

async function manualLoad() {
    const file = fileInputEl.value;
    if (!file) return;
    await loadConfigFile(file);
}

async function saveConfig(targetFilename = null) {
    syncCurrentTab();
    // Helper: If called via event listener, targetFilename is Event object. Ignore it.
    const filename = (typeof targetFilename === 'string') ? targetFilename : state.targetFile;
    try {
        const formData = new FormData();
        formData.append('filename', filename);
        // Save in new format with brandTitle, menus, and global areas
        const configData = {
            brandTitle: state.brandTitle,
            menus: state.config,
            globalHeader: state.globalHeader,
            globalFooter: state.globalFooter
        };
        formData.append('config', JSON.stringify(configData));
        const res = await fetch('api.php', { method: 'POST', body: formData });
        const json = await res.json();

        if (json.success) {
            alert('Saved!');
            if (targetFilename) {
                // Switch context to new file
                await loadConfigFile(targetFilename);
            }
        } else {
            alert('Save failed: ' + (json.message || 'Unknown error'));
        }
    } catch (e) {
        console.error(e);
        alert('Error saving.');
    }
}

// ============================================================
// RENDERING
// ============================================================
function renderSidebar() {
    menuTreeEl.innerHTML = '';
    state.config.forEach(menu => {
        const div = document.createElement('div');
        div.className = 'menu-item';

        // Check if menu has direct tabs (no submenus)
        const hasDirectTabs = menu.tabs && menu.tabs.length > 0 && (!menu.submenus || menu.submenus.length === 0);
        const isSelected = state.selectedMenuId === menu.id && !state.selectedSubmenuId;

        if (hasDirectTabs) {
            // Menu with direct tabs - clickable menu header
            div.innerHTML = `
                <div class="menu-header menu-direct ${isSelected ? 'active' : ''}" data-menu="${menu.id}">
                    <div>
                        <span><i class="fa-solid fa-file-alt"></i> ${menu.title}</span>
                        <i class="fa-solid fa-pen menu-edit" data-id="${menu.id}" title="Rename Menu" style="font-size:0.7rem;margin-left:5px;cursor:pointer;color:var(--text-muted);"></i>
                        <i class="fa-solid fa-trash menu-delete" data-id="${menu.id}" title="Delete Menu" style="font-size:0.7rem;margin-left:5px;cursor:pointer;color:var(--text-muted);"></i>
                    </div>
                </div>
            `;
        } else {
            // Menu with submenus - collapsible
            const isExpanded = state.selectedMenuId === menu.id;
            div.innerHTML = `
                <div class="menu-header menu-toggle" data-menu="${menu.id}">
                    <div>
                        <i class="fa-solid fa-chevron-right menu-chevron ${isExpanded ? 'expanded' : ''}" style="font-size:0.6rem;margin-right:5px;transition:transform 0.2s;"></i>
                        <span><i class="fa-solid fa-folder"></i> ${menu.title}</span>
                        <i class="fa-solid fa-pen menu-edit" data-id="${menu.id}" title="Rename Menu" style="font-size:0.7rem;margin-left:5px;cursor:pointer;color:var(--text-muted);"></i>
                        <i class="fa-solid fa-trash menu-delete" data-id="${menu.id}" title="Delete Menu" style="font-size:0.7rem;margin-left:5px;cursor:pointer;color:var(--text-muted);"></i>
                    </div>
                    <button class="icon-btn add-sub" data-id="${menu.id}"><i class="fa-solid fa-plus"></i></button>
                </div>
                <div class="submenu-list ${isExpanded ? 'open' : ''}">
                    <div class="submenu-inner">
                        ${(menu.submenus || []).map(sub => `
                            <div class="submenu-item ${state.selectedSubmenuId === sub.id ? 'active' : ''}" data-menu="${menu.id}" data-sub="${sub.id}">
                                <span>${sub.title}</span>
                                <div class="sub-actions" style="margin-left:auto;display:none;">
                                    <i class="fa-solid fa-pen submenu-edit" title="Rename Submenu" style="font-size:0.7rem;margin-right:5px;cursor:pointer;color:var(--text-muted);"></i>
                                    <i class="fa-solid fa-trash submenu-delete" title="Delete Submenu" style="font-size:0.7rem;cursor:pointer;color:var(--text-muted);"></i>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        menuTreeEl.appendChild(div);
    });

    // Click handler for direct menu (no submenus)
    document.querySelectorAll('.menu-direct').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.menu-edit') || e.target.closest('.menu-delete')) return;
            const menuId = el.dataset.menu;
            state.selectedMenuId = menuId;
            state.selectedSubmenuId = null; // No submenu
            const menu = state.config.find(m => m.id === menuId);
            if (menu?.tabs?.length) state.activeTabId = menu.tabs[0].id;
            renderSidebar();
            showWorkspace();
        });
    });

    // Click handler for menu toggle (expand/collapse submenus) - accordion style
    document.querySelectorAll('.menu-toggle').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.menu-edit') || e.target.closest('.menu-delete') || e.target.closest('.add-sub')) return;
            const menuItem = el.closest('.menu-item');
            const submenuList = menuItem.querySelector('.submenu-list');
            const chevron = el.querySelector('.menu-chevron');
            // Check if currently open (by class)
            const isOpen = submenuList?.classList.contains('open');

            // Accordion: collapse all other menus first
            document.querySelectorAll('.menu-item').forEach(item => {
                if (item !== menuItem) {
                    const otherList = item.querySelector('.submenu-list');
                    const otherChevron = item.querySelector('.menu-chevron');
                    if (otherList) otherList.classList.remove('open');
                    if (otherChevron) otherChevron.classList.remove('expanded');
                }
            });

            // Toggle clicked menu
            if (submenuList) {
                if (isOpen) {
                    submenuList.classList.remove('open');
                    if (chevron) chevron.classList.remove('expanded');
                } else {
                    submenuList.classList.add('open');
                    if (chevron) chevron.classList.add('expanded');
                }
            }
        });
    });

    // Submenu edit/delete icon hover effect
    document.querySelectorAll('.submenu-item').forEach(el => {
        const actions = el.querySelector('.sub-actions');
        if (actions) {
            el.addEventListener('mouseenter', () => actions.style.display = 'inline-block');
            el.addEventListener('mouseleave', () => actions.style.display = 'none');
        }
    });

    if (state.config.length === 0) {
        menuTreeEl.innerHTML = '<div style="padding:10px;color:var(--text-muted);text-align:center;">No menus</div>';
    }
}

function renderTabs() {
    const tabs = getTabs();
    if (tabs.length === 0) return;

    // Render tabs with edit controls + add button
    let html = tabs.map(t => `
        <div class="tab ${state.activeTabId === t.id ? 'active' : ''}" data-id="${t.id}">
            <span class="tab-title">${t.title}</span>
            <i class="fa-solid fa-pen tab-edit" title="Rename"></i>
            <i class="fa-solid fa-times tab-close" title="Delete"></i>
        </div>
    `).join('');

    // Add button at the end
    html += '<button id="add-tab-btn" class="tab-add"><i class="fa-solid fa-plus"></i></button>';

    tabsEl.innerHTML = html;
}

function renderGrid() {
    const tab = getTab();
    if (!tab) return;
    gridEl.innerHTML = '';
    (tab.components || []).forEach(comp => {
        const el = createGridItem(comp);
        gridEl.appendChild(el);
    });
}

// Render global header/footer areas in builder
function renderGlobalAreas() {
    const headerGrid = document.getElementById('global-header-grid');
    const footerGrid = document.getElementById('global-footer-grid');

    if (headerGrid) {
        headerGrid.innerHTML = '';
        (state.globalHeader?.components || []).forEach(comp => {
            const el = createGlobalComponent(comp, 'header');
            headerGrid.appendChild(el);
        });
    }

    if (footerGrid) {
        footerGrid.innerHTML = '';
        (state.globalFooter?.components || []).forEach(comp => {
            const el = createGlobalComponent(comp, 'footer');
            footerGrid.appendChild(el);
        });
    }
}

// Create a component element for global area
function createGlobalComponent(comp, area) {
    const el = document.createElement('div');
    el.className = 'global-component';
    el.dataset.id = comp.id;
    el.dataset.area = area;
    el.draggable = true;

    const icon = getComponentIcon(comp.type);
    el.innerHTML = `
        <i class="${icon}"></i>
        <span>${comp.label || comp.type}</span>
        <span class="remove-btn" title="Remove"><i class="fa-solid fa-times"></i></span>
    `;

    // Remove button
    el.querySelector('.remove-btn').onclick = (e) => {
        e.stopPropagation();
        const arr = area === 'header' ? state.globalHeader.components : state.globalFooter.components;
        const idx = arr.findIndex(c => c.id === comp.id);
        if (idx >= 0) {
            arr.splice(idx, 1);
            renderGlobalAreas();
        }
    };

    // Click to edit
    el.addEventListener('click', (e) => {
        if (e.target.closest('.remove-btn')) return;
        openComponentSettings(comp);
    });

    // Add grid-item class for shared drag/resize behavior if possible, 
    // BUT we need to distinguish global/local for state updates.
    // For now, let's keep it separate but mimic the style.

    return el;
}

// Get icon for component type
function getComponentIcon(type) {
    const icons = {
        button: 'fa-solid fa-square',
        label: 'fa-solid fa-tag',
        input: 'fa-solid fa-i-cursor',
        select: 'fa-solid fa-caret-down',
        checkbox: 'fa-solid fa-check-square',
        toggle: 'fa-solid fa-toggle-on',
        html: 'fa-solid fa-code'
    };
    return icons[type] || 'fa-solid fa-puzzle-piece';
}

function createGridItem(comp) {
    const el = document.createElement('div');
    el.className = 'grid-item';
    el.dataset.id = comp.id;

    // CSS Grid positioning (1-indexed)
    el.style.gridColumnStart = (comp.x || 0) + 1;
    el.style.gridColumnEnd = (comp.x || 0) + 1 + (comp.w || 4);
    el.style.gridRowStart = (comp.y || 0) + 1;
    el.style.gridRowEnd = (comp.y || 0) + 1 + (comp.h || 2);

    // Generate component-specific content
    const contentHtml = getComponentContent(comp);

    el.innerHTML = `
        <div class="item-header">
            <i class="fa-solid fa-grip-lines"></i>
            <i class="fa-solid fa-pen item-edit" title="Edit Label"></i>
            <i class="fa-solid fa-trash item-delete" title="Delete"></i>
        </div>
        <div class="item-content">${contentHtml}</div>
        <div class="resize-handle"></div>
    `;
    return el;
}

function getComponentContent(comp) {
    const label = comp.label || 'Label';
    const pos = comp.labelPosition || 'left'; // 'left' or 'right' or 'top' or 'bottom'
    let flexClass = 'label-left';
    if (pos === 'right') flexClass = 'label-right';
    if (pos === 'top') flexClass = 'label-top';
    if (pos === 'bottom') flexClass = 'label-bottom';

    switch (comp.type) {
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
        case 'select': {
            const options = comp.options || ['Option 1', 'Option 2', 'Option 3'];
            const defaultVal = comp.defaultValue || '';
            const optionsHtml = options.map(o => `<option${o === defaultVal ? ' selected' : ''}>${o}</option>`).join('');
            return pos === 'right'
                ? `<label class="comp-select ${flexClass}"><select>${optionsHtml}</select><span>${label}</span></label>`
                : `<label class="comp-select ${flexClass}"><span>${label}</span><select>${optionsHtml}</select></label>`;
        }
        case 'button':
            const btnStyle = comp.buttonStyle || 'normal'; // normal, info, danger, warning, disabled
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
                // Show file path info with load indicator
                const filename = comp.filePath.split('/').pop();
                return `<div class="comp-html comp-html-file" data-file="${comp.filePath}">
                    <i class="fa-solid fa-file-code"></i> ${filename}
                </div>`;
            } else {
                return `<div class="comp-html"><em>HTML/JS</em></div>`;
            }
        case 'checklist': {
            const items = comp.items || ['Option 1', 'Option 2', 'Option 3'];
            const mode = comp.checklistMode || 'single'; // 'single' (radio behavior) or 'multi' (checkbox)
            const inputType = mode === 'single' ? 'radio' : 'checkbox';
            const nameAttr = mode === 'single' ? `name="chk-${comp.id}"` : '';

            let listHtml = items.map((item, idx) => `
                <label class="checklist-item" style="display:flex;align-items:center;gap:6px;margin-bottom:4px;cursor:pointer;">
                    <input type="${inputType}" ${nameAttr} id="${comp.id}-${idx}" style="margin:0;width:auto;cursor:pointer;" ${(mode === 'single' && idx === 0) ? 'checked' : ''}>
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
            return `
                <div class="comp-placeholder">
                    <i class="fa-regular fa-window-restore" style="font-size:1.5rem;margin-bottom:0.5rem;"></i>
                    <div style="font-weight:600;">MODAL: ${label}</div>
                    <div style="font-size:0.7rem;">ID: ${comp.customId || '(No ID)'}</div>
                </div>
            `;
        case 'loading':
            return `
                <div class="comp-placeholder">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;margin-bottom:0.5rem;"></i>
                    <div style="font-weight:600;">LOADING SPINNER</div>
                    <div style="font-size:0.7rem;">ID: ${comp.customId || '(No ID)'}</div>
                </div>
            `;
        case 'chart':
            return `
                <div class="comp-placeholder">
                    <i class="fa-solid fa-chart-simple" style="font-size:1.5rem;margin-bottom:0.5rem;"></i>
                    <div style="font-weight:600;">CHART: ${comp.chartType || 'bar'}</div>
                    <div style="font-size:0.7rem;">Target: ${comp.targetTableId || '(None)'}</div>
                </div>
            `;
        case 'table': {
            const columns = comp.columns || ['Column 1', 'Column 2', 'Column 3'];
            const headerRow = columns.map(c => `<th>${c}</th>`).join('');
            return `
                <div class="comp-table-preview" style="width:100%;">
                    <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
                        <thead><tr style="background:var(--primary);color:white;">${headerRow}</tr></thead>
                        <tbody>
                            ${Array(Number(comp.pageSize) || 10).fill(0).map(() =>
                `<tr>${columns.map(() => '<td style="padding:4px;border:1px solid var(--border);height:20px;">...</td>').join('')}</tr>`
            ).join('')}
                        </tbody>
                    </table>
                    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">ID: ${comp.customId || '(No ID)'} | Page: ${comp.pageSize || 10} rows</div>
                </div>
            `;
        }
        default:
            return `<span>${label}</span>`;
    }
}

// ============================================================
// STATE HELPERS
// ============================================================
function getSubmenu() {
    const menu = state.config.find(m => m.id === state.selectedMenuId);
    // If no submenu selected but menu has direct tabs, return null (use getMenuTabs instead)
    if (!state.selectedSubmenuId) return null;
    return menu?.submenus?.find(s => s.id === state.selectedSubmenuId);
}

function getTab() {
    const menu = state.config.find(m => m.id === state.selectedMenuId);

    // Check for menu-level tabs first (no submenu selected)
    if (!state.selectedSubmenuId && menu?.tabs) {
        return menu.tabs.find(t => t.id === state.activeTabId);
    }

    // Otherwise, use submenu tabs
    const sub = getSubmenu();
    return sub?.tabs?.find(t => t.id === state.activeTabId);
}

function getTabsContainer() {
    const sub = getSubmenu();
    if (sub) return sub;
    const menu = state.config.find(m => m.id === state.selectedMenuId);
    if (!state.selectedSubmenuId && menu) return menu;
    return null;
}

// Get tabs array (from submenu or direct menu)
function getTabs() {
    const menu = state.config.find(m => m.id === state.selectedMenuId);

    // Menu-level tabs
    if (!state.selectedSubmenuId && menu?.tabs) {
        return menu.tabs;
    }

    // Submenu tabs
    const sub = getSubmenu();
    return sub?.tabs || [];
}

function syncCurrentTab() {
    const tab = getTab();
    if (!tab) return;

    // Update components from grid DOM
    const items = gridEl.querySelectorAll('.grid-item');
    const updatedComps = [];

    items.forEach(el => {
        const id = el.dataset.id;
        // Parse grid position from style
        const x = parseInt(el.style.gridColumnStart) - 1;
        const w = parseInt(el.style.gridColumnEnd) - parseInt(el.style.gridColumnStart);
        const y = parseInt(el.style.gridRowStart) - 1;
        const h = parseInt(el.style.gridRowEnd) - parseInt(el.style.gridRowStart);

        // Find original component data
        const orig = tab.components.find(c => c.id === id) || {};
        updatedComps.push({ ...orig, id, x, y, w, h });
    });

    tab.components = updatedComps;
}

// ============================================================
// HTML COMPONENT EDITOR
// ============================================================
function openHtmlEditor(comp) {
    currentEditComp = comp;
    modalTitleEl.textContent = 'Edit HTML Component';
    modalBodyEl.innerHTML = `
        <div class="html-editor-tabs">
            <button class="html-tab active" data-mode="file">File Path</button>
            <button class="html-tab" data-mode="direct">Direct Edit</button>
        </div>
        <div class="html-editor-content">
                    <div id="file-mode" class="editor-mode active">
                        <label>File Path:</label>
                        <input type="text" id="html-file-path" placeholder="e.g. components/widget.html" value="${comp.filePath || ''}">
                            <small>Relative path to HTML file</small>
                    </div>
                    <div id="direct-mode" class="editor-mode hidden">
                        <label>HTML Content:</label>
                        <textarea id="html-direct-content" rows="10" placeholder="&lt;div&gt;Your HTML...&lt;/div&gt;">${comp.content || ''}</textarea>
                    </div>
                </div>
            `;

    // Tab switching
    modalBodyEl.querySelectorAll('.html-tab').forEach(tab => {
        tab.onclick = () => {
            modalBodyEl.querySelectorAll('.html-tab').forEach(t => t.classList.remove('active'));
            modalBodyEl.querySelectorAll('.editor-mode').forEach(m => m.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.mode + '-mode').classList.remove('hidden');
        };
    });

    // Show correct mode based on existing data
    if (comp.content && !comp.filePath) {
        modalBodyEl.querySelector('[data-mode="direct"]').click();
    }

    modalEl.classList.remove('hidden');
}

function handleHtmlEditorConfirm() {
    if (!currentEditComp) return;

    const filePath = document.getElementById('html-file-path')?.value?.trim();
    const directContent = document.getElementById('html-direct-content')?.value;

    if (filePath) {
        currentEditComp.filePath = filePath;
        currentEditComp.content = null; // Clear direct content if using file
    } else if (directContent) {
        currentEditComp.content = directContent;
        currentEditComp.filePath = null; // Clear file path if using direct
    }

    currentEditComp = null;
    closeModal();
    renderGrid();
}

function closeModal() {
    // Destroy CodeMirror instance if exists
    if (codeMirrorInstance) {
        codeMirrorInstance.toTextArea();
        codeMirrorInstance = null;
    }
    modalEl.classList.add('hidden');
    currentEditComp = null;
}

function openComponentSettings(comp) {
    currentEditComp = comp;
    modalTitleEl.textContent = 'Component Settings';

    // Base fields for all components
    let html = `
                <div class="settings-group">
            <label>ID (for JavaScript):</label>
            <input type="text" id="comp-custom-id" placeholder="e.g. myCheckbox" value="${comp.customId || ''}">
        </div>
        <div class="settings-group">
            <label>Class (CSS classes):</label>
            <input type="text" id="comp-custom-class" placeholder="e.g. my-class another-class" value="${comp.customClass || ''}">
        </div>
        <div class="settings-group">
            <label>Label:</label>
            <input type="text" id="comp-label" value="${comp.label || ''}">
        </div>
            `;

    // Button specific
    if (comp.type === 'button') {
        html += `
                <div class="settings-group">
                <label>Style:</label>
                <select id="comp-button-style">
                    <option value="normal" ${(!comp.buttonStyle || comp.buttonStyle === 'normal') ? 'selected' : ''}>Normal (Blue)</option>
                    <option value="info" ${(comp.buttonStyle === 'info') ? 'selected' : ''}>Info (Cyan)</option>
                    <option value="danger" ${(comp.buttonStyle === 'danger') ? 'selected' : ''}>Danger (Red)</option>
                    <option value="warning" ${(comp.buttonStyle === 'warning') ? 'selected' : ''}>Warning (Orange)</option>
                    <option value="disabled" ${(comp.buttonStyle === 'disabled') ? 'selected' : ''}>Disabled</option>
                </select>
            </div>
                <div class="settings-group">
                    <label>OnClick (JS):</label>
                    <input type="text" id="comp-button-onclick" placeholder="alert('Hello')" value="${(comp.onClick || '').replace(/" /g, '&quot;')}">
                </div>
            `;
    }

    // Select specific
    if (comp.type === 'select') {
        const optionsStr = (comp.options || ['Option 1', 'Option 2', 'Option 3']).join('\n');
        html += `
                <div class="settings-group">
                <label>Options (one per line):</label>
                <textarea id="comp-select-options" rows="5" placeholder="Option 1\nOption 2">${optionsStr}</textarea>
            </div>
                <div class="settings-group">
                    <label>Default Value:</label>
                    <input type="text" id="comp-select-default" value="${comp.defaultValue || ''}" placeholder="Option 1">
                </div>
            `;
    }

    // HTML-specific fields (and Modal)
    if (comp.type === 'html' || comp.type === 'modal') {
        html += `
                <div class="settings-group">
                <label>${comp.type === 'modal' ? 'Modal Content (HTML):' : 'Source:'}</label>
                <div class="html-editor-tabs">
                    <button class="html-tab ${!comp.content ? 'active' : ''}" data-mode="file">File Path</button>
                    <button class="html-tab ${comp.content ? 'active' : ''}" data-mode="direct">Direct Edit</button>
                </div>
            </div>
            <div id="file-mode" class="editor-mode ${!comp.content ? '' : 'hidden'}">
                <label>File Path:</label>
                <input type="text" id="html-file-path" placeholder="components/widget.html" value="${comp.filePath || ''}" style="width:100%;margin-bottom:5px;">
                <button id="html-file-browse" class="btn-sm" title="Browse Files" style="width:auto;"><i class="fa-solid fa-folder-open"></i> Browse</button>
            </div>
            <div id="direct-mode" class="editor-mode ${comp.content ? '' : 'hidden'}">
                <label>HTML Content:</label>
                <textarea id="html-direct-content" rows="8">${comp.content || ''}</textarea>
            </div>
            `;
    }

    if (comp.type === 'modal') {
        html += `
                <div class="settings-group">
                <label>Footer Buttons (Label | Style | OnClick) - One per line:</label>
                <textarea id="comp-modal-buttons" rows="3" placeholder="Close | normal | close()">${(comp.modalButtons || []).map(b => `${b.label} | ${b.style} | ${b.onClick}`).join('\n')}</textarea>
                <small style="color:var(--text-muted);display:block;margin-top:4px;">Styles: normal, info, danger, warning, disabled</small>
            </div>
                `;
    }

    // Loading specific
    if (comp.type === 'loading') {

        html += `
                <div class="settings-group">
                <label>Loading Text (optional):</label>
                <input type="text" id="comp-loading-text" placeholder="Processing..." value="${comp.loadingText || ''}">
            </div>
            `;
    }

    // DatePicker specific
    if (comp.type === 'datepicker') {
        html += `
                <div class="settings-group">
                    <label><input type="checkbox" id="comp-include-time" ${comp.includeTime ? 'checked' : ''}> Include time</label>
            </div>
                `;
    }

    // Checklist specific
    if (comp.type === 'checklist') {
        html += `
                <div class="settings-group">
                <label>Mode:</label>
                <select id="comp-checklist-mode">
                    <option value="single" ${(!comp.checklistMode || comp.checklistMode === 'single') ? 'selected' : ''}>Single Select (Toggle/Radio)</option>
                    <option value="multi" ${(comp.checklistMode === 'multi') ? 'selected' : ''}>Multi Select (Checkbox)</option>
                </select>
            </div>
                <div class="settings-group">
                    <label>Items (one per line):</label>
                    <textarea id="comp-checklist-items" rows="5" placeholder="Item 1\nItem 2">${(comp.items || []).join('\n')}</textarea>
                </div>
            `;
    }

    // Table specific
    if (comp.type === 'table') {
        html += `
            <div class="settings-group">
                <label>Display Columns (comma separated):</label>
                <input type="text" id="comp-table-columns" placeholder="名前, 年齢, メール" value="${(comp.columns || []).join(', ')}">
                <small style="color:var(--text-muted)">表示するカラム名（ヘッダーに表示される）</small>
            </div>
            <div class="settings-group">
                <label>Data Keys (comma separated):</label>
                <input type="text" id="comp-table-keys" placeholder="Name, Age, Email" value="${(comp.columnKeys || []).join(', ')}">
                <small style="color:var(--text-muted)">データのキー名（表示カラムと同じ順序で指定）</small>
            </div>
            <div class="settings-group">
                <label>Rows per page:</label>
                <input type="number" id="comp-table-pagesize" min="1" max="100" value="${comp.pageSize || 10}">
            </div>
            `;
    }

    // Chart specific
    if (comp.type === 'chart') {
        html += `
                <div class="settings-group">
                <label>Target Table ID:</label>
                <input type="text" id="comp-chart-tableid" value="${comp.targetTableId || ''}" placeholder="table-id">
            </div>
            <div class="settings-group">
                <label>Chart Type:</label>
                <select id="comp-chart-type">
                    <option value="bar" ${(!comp.chartType || comp.chartType === 'bar') ? 'selected' : ''}>Bar Chart</option>
                    <option value="pie" ${(comp.chartType === 'pie') ? 'selected' : ''}>Pie Chart</option>
                    <option value="histogram" ${(comp.chartType === 'histogram') ? 'selected' : ''}>Histogram (Frequency)</option>
                </select>
            </div>
            <div class="settings-group">
                <label>Data Column (Header):</label>
                <input type="text" id="comp-chart-datacol" value="${comp.dataColumn || ''}" placeholder="e.g. Price">
                <small style="color:var(--text-muted)">Column name to use for values (Y)</small>
            </div>
            <div class="settings-group">
                <label>Label Column (Header) [Optional]:</label>
                <input type="text" id="comp-chart-labelcol" value="${comp.labelColumn || ''}" placeholder="e.g. Name">
                <small style="color:var(--text-muted)">Column name for labels (X). Unused for Histogram.</small>
            </div>
            `;
    }

    // Label position for labeled components
    if (['checkbox', 'toggle', 'input', 'datepicker', 'select'].includes(comp.type)) {
        html += `
                <div class="settings-group">
                <label>Label Position:</label>
                <select id="comp-label-position">
                    <option value="left" ${(!comp.labelPosition || comp.labelPosition === 'left') ? 'selected' : ''}>Left</option>
                    <option value="right" ${comp.labelPosition === 'right' ? 'selected' : ''}>Right</option>
                    <option value="top" ${comp.labelPosition === 'top' ? 'selected' : ''}>Top</option>
                    <option value="bottom" ${comp.labelPosition === 'bottom' ? 'selected' : ''}>Bottom</option>
                </select>
            </div>
                `;
    }

    modalBodyEl.innerHTML = html;

    // Tab switching for HTML
    modalBodyEl.querySelectorAll('.html-tab').forEach(tab => {
        tab.onclick = () => {
            modalBodyEl.querySelectorAll('.html-tab').forEach(t => t.classList.remove('active'));
            modalBodyEl.querySelectorAll('.editor-mode').forEach(m => m.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.mode + '-mode')?.classList.remove('hidden');
            // Refresh CodeMirror when direct tab is shown
            if (tab.dataset.mode === 'direct' && codeMirrorInstance) {
                setTimeout(() => codeMirrorInstance.refresh(), 10);
            }
        };
    });

    // Ensure footer is visible (may have been hidden by other modal uses)
    const footer = modalEl.querySelector('footer');
    if (footer) footer.style.display = 'flex';

    modalEl.classList.remove('hidden');

    // Initialize CodeMirror for HTML/Modal type
    if (comp.type === 'html' || comp.type === 'modal') {
        const textarea = document.getElementById('html-direct-content');
        if (textarea && typeof CodeMirror !== 'undefined') {
            codeMirrorInstance = CodeMirror.fromTextArea(textarea, {
                mode: 'htmlmixed',
                theme: 'dracula',
                lineNumbers: true,
                autoCloseTags: true,
                autoCloseBrackets: true,
                matchBrackets: true,
                indentUnit: 2,
                tabSize: 2,
                lineWrapping: true,
                extraKeys: {
                    'Ctrl-Space': 'autocomplete',
                    'Tab': function (cm) {
                        cm.replaceSelection('  ', 'end');
                    }
                }
            });
            codeMirrorInstance.setSize('100%', '200px');
            // Auto-show hints on input
            codeMirrorInstance.on('inputRead', function (cm, change) {
                if (change.text[0].match(/[<a-zA-Z]/)) {
                    CodeMirror.commands.autocomplete(cm, null, { completeSingle: false });
                }
            });
        }

        // Browse button
        const browseBtn = document.getElementById('html-file-browse');
        if (browseBtn) {
            browseBtn.onclick = () => {
                // Open file browser on top (z-index 10001)
                openSelectFileModal((filename, currentPath) => {
                    // Store in global variable
                    pendingFilePath = filename;

                    // Update component reference immediately
                    if (currentEditComp) {
                        currentEditComp.filePath = filename;
                        currentEditComp.content = null;
                    }

                    // Update the input field
                    const pathInput = document.getElementById('html-file-path');
                    if (pathInput) {
                        pathInput.value = filename;
                    }
                }, ['html', 'htm', 'js', 'css', 'php', 'txt'], 'Select Widget File');
            };
        }

        // Force set input value after everything is initialized (fixes display issue)
        setTimeout(() => {
            const pathInput = document.getElementById('html-file-path');
            if (pathInput && comp.filePath) {
                pathInput.value = comp.filePath;
            }
        }, 50);
    }
}

function saveComponentState() {
    if (!currentEditComp) return;

    // Common fields
    currentEditComp.customId = document.getElementById('comp-custom-id')?.value?.trim() || null;
    currentEditComp.customClass = document.getElementById('comp-custom-class')?.value?.trim() || null;
    currentEditComp.label = document.getElementById('comp-label')?.value?.trim() || currentEditComp.label;

    // Button specific
    if (currentEditComp.type === 'button') {
        currentEditComp.buttonStyle = document.getElementById('comp-button-style')?.value || 'normal';
        currentEditComp.onClick = document.getElementById('comp-button-onclick')?.value || '';
    }

    // Select specific
    if (currentEditComp.type === 'select') {
        const optionsText = document.getElementById('comp-select-options')?.value || '';
        currentEditComp.options = optionsText.split('\n').filter(line => line.trim());
        currentEditComp.defaultValue = document.getElementById('comp-select-default')?.value?.trim() || '';
    }

    // HTML/Modal specific
    if (currentEditComp.type === 'html' || currentEditComp.type === 'modal') {
        const fileTabActive = document.querySelector('.html-tab[data-mode="file"]')?.classList.contains('active');

        // Use pendingFilePath if set (from file browser), otherwise read from input
        const inputFilePath = document.getElementById('html-file-path')?.value?.trim();
        const filePath = pendingFilePath || inputFilePath;

        // Get content from CodeMirror if available, otherwise from textarea
        const directContent = codeMirrorInstance ? codeMirrorInstance.getValue() : document.getElementById('html-direct-content')?.value;

        if (fileTabActive && filePath) {
            currentEditComp.filePath = filePath;
            currentEditComp.content = null;
            pendingFilePath = null; // Clear after use
        } else {
            // Direct mode or file path empty -> use direct content
            currentEditComp.content = directContent;
            currentEditComp.filePath = null;
        }

        if (currentEditComp.type === 'modal') {
            const btnsText = document.getElementById('comp-modal-buttons')?.value || '';
            currentEditComp.modalButtons = btnsText.split('\n').filter(line => line.trim()).map(line => {
                const parts = line.split('|').map(p => p.trim());
                return {
                    label: parts[0] || 'Button',
                    style: parts[1] || 'normal',
                    onClick: parts[2] || ''
                };
            });
        }
    }

    // Loading specific
    if (currentEditComp.type === 'loading') {
        currentEditComp.loadingText = document.getElementById('comp-loading-text')?.value?.trim() || '';
    }

    // DatePicker specific
    if (currentEditComp.type === 'datepicker') {
        currentEditComp.includeTime = document.getElementById('comp-include-time')?.checked || false;
    }

    // Checklist specific
    if (currentEditComp.type === 'checklist') {
        currentEditComp.checklistMode = document.getElementById('comp-checklist-mode')?.value || 'multi';
        const itemsText = document.getElementById('comp-checklist-items')?.value || '';
        currentEditComp.items = itemsText.split('\n').map(line => line.trim()).filter(line => line !== '');
    }

    // Table specific
    if (currentEditComp.type === 'table') {
        const columnsText = document.getElementById('comp-table-columns')?.value || '';
        currentEditComp.columns = columnsText.split(',').map(c => c.trim().replace(/^["']|["']$/g, '')).filter(c => c !== '');
        const keysText = document.getElementById('comp-table-keys')?.value || '';
        currentEditComp.columnKeys = keysText.split(',').map(c => c.trim().replace(/^["']|["']$/g, '')).filter(c => c !== '');
        currentEditComp.pageSize = parseInt(document.getElementById('comp-table-pagesize')?.value) || 10;
    }

    // Chart specific
    if (currentEditComp.type === 'chart') {
        currentEditComp.targetTableId = document.getElementById('comp-chart-tableid')?.value?.trim() || '';
        currentEditComp.chartType = document.getElementById('comp-chart-type')?.value || 'bar';
        currentEditComp.dataColumn = document.getElementById('comp-chart-datacol')?.value?.trim() || '';
        currentEditComp.labelColumn = document.getElementById('comp-chart-labelcol')?.value?.trim() || '';
    }

    // Label position
    const labelPos = document.getElementById('comp-label-position')?.value;
    if (labelPos) currentEditComp.labelPosition = labelPos;
}

function handleModalConfirm() {
    if (!currentEditComp) return;
    saveComponentState();
    closeModal();
    renderGrid();
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {

    // Global Header/Footer Toggle Buttons
    // Global Header Toggle
    document.getElementById('toggle-global-header')?.addEventListener('click', function () {
        this.classList.toggle('active');
        const editor = document.getElementById('global-header-editor');
        editor?.classList.toggle('hidden');
        renderGlobalAreas();
    });

    // Global Header Delete
    // Global Header Delete
    document.getElementById('delete-global-header')?.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('Global Header のコンポーネントをすべて削除してもよろしいですか？')) {
            state.globalHeader.components = [];
            renderGlobalAreas();

            // Hide the editor and reset toggle button
            const editor = document.getElementById('global-header-editor');
            if (editor) editor.classList.add('hidden');

            const toggle = document.getElementById('toggle-global-header');
            if (toggle) toggle.classList.remove('active');
        }
    });

    // Brand Title Edit
    document.getElementById('brand-title')?.addEventListener('click', () => {
        const newTitle = prompt('Dashboard Title:', state.brandTitle);
        if (newTitle && newTitle.trim()) {
            state.brandTitle = newTitle.trim();
            const brandTextEl = document.getElementById('brand-text');
            if (brandTextEl) brandTextEl.textContent = state.brandTitle;
        }
    });

    // Add Menu
    document.getElementById('add-menu-btn').addEventListener('click', () => {
        const title = prompt('Menu title:');
        if (title) {
            const hasSubmenus = confirm('サブメニューを使用しますか？\n\nOK = サブメニューあり\nキャンセル = 直接タブを配置');
            if (hasSubmenus) {
                // Traditional menu with submenus
                state.config.push({ id: 'menu-' + Date.now(), title, submenus: [] });
            } else {
                // Direct tabs menu (no submenus)
                state.config.push({ id: 'menu-' + Date.now(), title, tabs: [{ id: 'tab-' + Date.now(), title: 'Main', components: [] }] });
            }
            renderSidebar();
        }
    });

    // Add Submenu (delegated)
    menuTreeEl.addEventListener('click', e => {
        const addBtn = e.target.closest('.add-sub');
        if (addBtn) {
            const menuId = addBtn.dataset.id;
            const title = prompt('Submenu title:');
            if (title) {
                const menu = state.config.find(m => m.id === menuId);
                menu.submenus.push({ id: 'sub-' + Date.now(), title, tabs: [{ id: 'tab-' + Date.now(), title: 'Main', components: [] }] });
                renderSidebar();
            }
            return;
        }

        // Select Submenu
        const subItem = e.target.closest('.submenu-item');
        if (subItem) {
            state.selectedMenuId = subItem.dataset.menu;
            state.selectedSubmenuId = subItem.dataset.sub;
            const sub = getSubmenu();
            if (sub?.tabs?.length > 0) state.activeTabId = sub.tabs[0].id;
            showWorkspace();
        }

        // Rename Submenu
        const subEdit = e.target.closest('.submenu-edit');
        if (subEdit) {
            e.stopPropagation();
            const subItem = subEdit.closest('.submenu-item');
            const menuId = subItem.dataset.menu;
            const subId = subItem.dataset.sub;
            const menu = state.config.find(m => m.id === menuId);
            const sub = menu.submenus.find(s => s.id === subId);

            const newTitle = prompt('Rename Submenu:', sub.title);
            if (newTitle) {
                sub.title = newTitle;
                renderSidebar();
            }
            return;
        }

        // Rename Menu
        const menuEdit = e.target.closest('.menu-edit');
        if (menuEdit) {
            e.stopPropagation();
            const menuId = menuEdit.dataset.id;
            const menu = state.config.find(m => m.id === menuId);

            const newTitle = prompt('Rename Menu:', menu.title);
            if (newTitle) {
                menu.title = newTitle;
                renderSidebar();
            }
            return;
        }

        // Delete Submenu
        const subDelete = e.target.closest('.submenu-delete');
        if (subDelete) {
            e.stopPropagation();
            const subItem = subDelete.closest('.submenu-item');
            const menuId = subItem.dataset.menu;
            const subId = subItem.dataset.sub;
            const menu = state.config.find(m => m.id === menuId);

            if (confirm('Delete this submenu?')) {
                menu.submenus = menu.submenus.filter(s => s.id !== subId);
                // Reset active states if deleted one was active
                if (state.selectedSubmenuId === subId) {
                    state.selectedSubmenuId = null;
                    state.activeTabId = null;
                    // Try to fallback
                    if (menu.submenus.length > 0) {
                        state.selectedSubmenuId = menu.submenus[0].id;
                        if (menu.submenus[0].tabs.length > 0) state.activeTabId = menu.submenus[0].tabs[0].id;
                    }
                }
                renderSidebar();
                showWorkspace(); // To update visibility
            }
            return;
        }

        // Delete Menu
        const menuDelete = e.target.closest('.menu-delete');
        if (menuDelete) {
            e.stopPropagation();
            const menuId = menuDelete.dataset.id;

            if (confirm('Delete this entire menu?')) {
                state.config = state.config.filter(m => m.id !== menuId);
                // If deleted menu contained active submenu, reset
                if (state.selectedMenuId === menuId) {
                    state.selectedMenuId = null;
                    state.selectedSubmenuId = null;
                    state.activeTabId = null;
                }
                renderSidebar();
                showWorkspace();
            }
            return;
        }
    });

    // Tab selection (delegated)
    tabsEl.addEventListener('click', e => {
        // Delete Tab
        if (e.target.classList.contains('tab-close')) {
            e.stopPropagation();
            const tabId = e.target.closest('.tab').dataset.id;
            const container = getTabsContainer();
            if (!container) return;

            if (container.tabs.length <= 1) {
                alert('Cannot delete the last tab.');
                return;
            }

            if (confirm('Delete this tab?')) {
                container.tabs = container.tabs.filter(t => t.id !== tabId);
                if (state.activeTabId === tabId) {
                    state.activeTabId = container.tabs[0].id; // Switch to first available
                }
                renderTabs();
                renderGrid();
            }
            return;
        }

        // Rename Tab (Click on edit icon)
        if (e.target.classList.contains('tab-edit')) {
            e.stopPropagation();
            const tabEl = e.target.closest('.tab');
            const tabId = tabEl.dataset.id;
            const container = getTabsContainer();
            if (!container) return;
            const tabData = container.tabs.find(t => t.id === tabId);

            const newTitle = prompt('Rename tab:', tabData.title);
            if (newTitle && newTitle.trim() !== '') {
                tabData.title = newTitle.trim();
                renderTabs();
            }
            return;
        }

        // Add Tab (button is now inside tabs container)
        if (e.target.closest('#add-tab-btn')) {
            const container = getTabsContainer();
            if (!container) return;
            const title = prompt('Tab title:');
            if (title) {
                const newId = 'tab-' + Date.now();
                container.tabs.push({ id: newId, title, components: [] });
                state.activeTabId = newId;
                renderTabs();
                renderGrid();
            }
            return;
        }

        // Select Tab
        const tab = e.target.closest('.tab');
        if (tab) {
            syncCurrentTab();
            state.activeTabId = tab.dataset.id;
            renderTabs();
            renderGrid();
        }
    });

    // Save
    document.getElementById('save-btn').addEventListener('click', openSaveOptionsModal);
    // Removed save-as-btn listener
    // document.getElementById('save-as-btn').addEventListener('click', openSaveAsModal);

    // Browse
    document.getElementById('browse-btn').addEventListener('click', openFileBrowserModal);

    // Modal close
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-confirm').addEventListener('click', handleModalConfirm);

    // Header Tools Button Toggle (dropdown)
    document.getElementById('header-tools-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('tools-dropdown')?.classList.toggle('show');
        document.getElementById('header-tools-btn')?.classList.toggle('active',
            document.getElementById('tools-dropdown')?.classList.contains('show'));
    });

    // Close tools dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.tools-menu')) {
            document.getElementById('tools-dropdown')?.classList.remove('show');
            document.getElementById('header-tools-btn')?.classList.remove('active');
        }
    });

    // Grid Drag & Drop from Toolbox
    setupToolboxDnD();

    // Grid Item Drag/Resize
    setupGridInteraction();
}

function showWorkspace() {
    emptyStateEl.classList.add('hidden');
    workspaceEl.classList.remove('hidden');
    // Show header tools menu
    const toolsMenu = document.getElementById('tools-menu');
    if (toolsMenu) toolsMenu.classList.remove('hidden');
    const menu = state.config.find(m => m.id === state.selectedMenuId);
    const sub = getSubmenu();

    // Set breadcrumb based on whether submenu exists
    if (sub) {
        breadcrumbsEl.textContent = `${menu?.title} > ${sub?.title} `;
    } else {
        breadcrumbsEl.textContent = menu?.title || '';
    }

    // Get or create tabs array (from submenu or menu)
    let tabsContainer = sub || menu;
    if (!tabsContainer) return;

    if (!tabsContainer.tabs) {
        tabsContainer.tabs = [];
    }

    // Auto-create default tab if none exists
    if (tabsContainer.tabs.length === 0) {
        const defaultTab = { id: 'tab-' + Date.now(), title: 'Main', components: [] };
        tabsContainer.tabs.push(defaultTab);
        console.log('Created default tab:', defaultTab);
    }

    // Always select first tab
    state.activeTabId = tabsContainer.tabs[0].id;
    console.log('showWorkspace - activeTabId:', state.activeTabId, 'tabs:', tabsContainer.tabs);

    renderTabs();
    renderGrid();
}

// ============================================================
// TOOLBOX DRAG & DROP
// ============================================================
function setupToolboxDnD() {
    const tools = document.querySelectorAll('.tool');
    tools.forEach(tool => {
        tool.addEventListener('dragstart', e => {
            e.dataTransfer.setData('type', tool.dataset.type);
        });
    });

    gridEl.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    gridEl.addEventListener('drop', e => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type');
        console.log('Drop event:', type);
        if (!type) {
            console.log('No type data');
            return;
        }

        const tab = getTab();
        if (!tab) {
            console.log('No active tab');
            return;
        }

        // IMPORTANT: Sync existing items first to preserve their positions
        syncCurrentTab();

        // Calculate grid position
        const rect = gridEl.getBoundingClientRect();
        const cellW = rect.width / 48;
        const cellH = 22; // 20 + 2 gap
        const x = Math.floor((e.clientX - rect.left) / cellW);
        const y = Math.floor((e.clientY - rect.top) / cellH);
        console.log('Calculated position:', x, y);

        // Component-specific defaults
        const typeLabels = {
            html: 'HTML/JS',
            button: 'Button',
            form: 'Form',
            checkbox: 'Checkbox',
            toggle: 'Toggle',
            input: 'Input',
            select: 'Select',
            chart: 'Chart',
            datepicker: 'Calendar'
        };

        const newComp = {
            id: 'comp-' + Date.now(),
            type,
            label: typeLabels[type] || type,
            labelPosition: 'left', // 'left' or 'right',
            checklistMode: type === 'checklist' ? 'single' : undefined,
            x: Math.max(0, Math.min(x, 32)), // Keep in bounds (48 - 16)
            y: Math.max(0, y),
            w: (type === 'checkbox' || type === 'toggle') ? 12 : 16,
            h: 2
        };
        tab.components.push(newComp);
        console.log('Added component:', newComp);

        // Append new item only (don't re-render all)
        const el = createGridItem(newComp);
        gridEl.appendChild(el);
        console.log('Appended to grid');
    });

    // Global area drag & drop
    setupGlobalAreaDnD('global-header-grid', 'header');
    setupGlobalAreaDnD('global-footer-grid', 'footer');
}

// Setup drag & drop for global areas (with reordering)
function setupGlobalAreaDnD(gridId, areaType) {
    const areaGrid = document.getElementById(gridId);
    if (!areaGrid) return;

    // Handle reordering source
    areaGrid.addEventListener('dragstart', e => {
        const comp = e.target.closest('.global-component');
        if (comp) {
            e.dataTransfer.setData('reorder-id', comp.dataset.id);
            e.dataTransfer.setData('source-area', areaType);
            e.dataTransfer.effectAllowed = 'move';
            areaGrid.classList.add('drag-over');
        }
    });

    areaGrid.addEventListener('dragover', e => {
        e.preventDefault();

        // Determine insertion point
        const target = e.target.closest('.global-component');
        const reorderId = e.dataTransfer.getData('reorder-id'); // Note: getData not always available in dragover

        // Remove existing placeholders
        const existingPlaceholder = areaGrid.querySelector('.drop-placeholder');
        if (existingPlaceholder) existingPlaceholder.remove();

        // Visual feedback
        const placeholder = document.createElement('div');
        placeholder.className = 'drop-placeholder';
        placeholder.style.width = '4px';
        placeholder.style.height = '30px';
        placeholder.style.background = 'var(--primary)';
        placeholder.style.borderRadius = '2px';
        placeholder.style.margin = '0 4px';

        if (target) {
            const rect = target.getBoundingClientRect();
            const midX = rect.left + rect.width / 2;
            if (e.clientX < midX) {
                areaGrid.insertBefore(placeholder, target);
            } else {
                areaGrid.insertBefore(placeholder, target.nextSibling);
            }
        } else {
            areaGrid.appendChild(placeholder);
        }

        areaGrid.classList.add('drag-over');
    });

    areaGrid.addEventListener('dragleave', e => {
        // Only remove if leaving the valid drop zone completely
        if (!areaGrid.contains(e.relatedTarget)) {
            areaGrid.classList.remove('drag-over');
            const placeholder = areaGrid.querySelector('.drop-placeholder');
            if (placeholder) placeholder.remove();
        }
    });

    areaGrid.addEventListener('drop', e => {
        e.preventDefault();
        areaGrid.classList.remove('drag-over');

        const placeholder = areaGrid.querySelector('.drop-placeholder');
        let dropIndex = -1;
        if (placeholder) {
            // Calculate index based on placeholder position among component elements
            const children = Array.from(areaGrid.children).filter(c => c.classList.contains('global-component') || c.classList.contains('drop-placeholder'));
            dropIndex = children.indexOf(placeholder);
            placeholder.remove();
        }

        // Case 1: Reordering existing component
        const reorderId = e.dataTransfer.getData('reorder-id');
        const sourceArea = e.dataTransfer.getData('source-area');

        if (reorderId) {
            if (sourceArea !== areaType) return; // Prevent moving between header/footer for simplicity

            const targetArray = areaType === 'header' ? state.globalHeader.components : state.globalFooter.components;
            const oldIndex = targetArray.findIndex(c => c.id === reorderId);

            if (oldIndex >= 0) {
                const [item] = targetArray.splice(oldIndex, 1);
                // Adjust index if shifting occurred
                if (dropIndex > oldIndex) dropIndex--;
                if (dropIndex < 0) dropIndex = targetArray.length; // Default to end

                targetArray.splice(dropIndex, 0, item);
                renderGlobalAreas();
            }
            return;
        }

        // Case 2: Adding new tool
        const type = e.dataTransfer.getData('type');
        if (!type) return;

        const typeLabels = {
            html: 'HTML/JS',
            button: 'Button',
            checkbox: 'Checkbox',
            toggle: 'Toggle',
            input: 'Input',
            label: 'Label',
            select: 'Select',
            form: 'Form',
            checklist: 'Checklist',
            datepicker: 'Calendar',
            modal: 'Modal',
            table: 'Table',
            chart: 'Chart'
        };

        const newComp = {
            id: 'comp-' + Date.now(),
            type,
            label: typeLabels[type] || type
        };

        const targetArray = areaType === 'header' ? state.globalHeader.components : state.globalFooter.components;
        if (dropIndex >= 0 && dropIndex <= targetArray.length) {
            targetArray.splice(dropIndex, 0, newComp);
        } else {
            targetArray.push(newComp);
        }
        renderGlobalAreas();
    });
}

// GRID ITEM DRAG & RESIZE
// ============================================================
function setupGridInteraction() {
    gridEl.addEventListener('mousedown', e => {
        const item = e.target.closest('.grid-item');
        if (!item) return;

        // Edit Component Settings
        if (e.target.classList.contains('item-edit')) {
            e.stopPropagation();
            const compId = item.dataset.id;
            const tab = getTab();
            const comp = tab.components.find(c => c.id === compId);
            if (!comp) return;

            openComponentSettings(comp);
            return;
        }

        // Delete Component
        if (e.target.classList.contains('item-delete')) {
            e.stopPropagation();
            const compId = item.dataset.id;
            const tab = getTab();
            if (confirm('Delete this component?')) {
                tab.components = tab.components.filter(c => c.id !== compId);
                renderGrid();
            }
            return;
        }

        const isResize = e.target.classList.contains('resize-handle');
        const isHeader = e.target.closest('.item-header');

        if (!isResize && !isHeader) return;

        e.preventDefault();
        const rect = gridEl.getBoundingClientRect();
        const cellW = rect.width / 48;
        const cellH = 22;

        dragState = {
            item,
            isResize,
            startX: e.clientX,
            startY: e.clientY,
            origColStart: parseInt(item.style.gridColumnStart),
            origColEnd: parseInt(item.style.gridColumnEnd),
            origRowStart: parseInt(item.style.gridRowStart),
            origRowEnd: parseInt(item.style.gridRowEnd),
            cellW,
            cellH
        };

        if (!isResize) item.classList.add('dragging');

        // Create ghost
        const ghost = document.createElement('div');
        ghost.className = 'ghost';
        ghost.id = 'drag-ghost';
        ghost.style.gridColumnStart = dragState.origColStart;
        ghost.style.gridColumnEnd = dragState.origColEnd;
        ghost.style.gridRowStart = dragState.origRowStart;
        ghost.style.gridRowEnd = dragState.origRowEnd;
        gridEl.appendChild(ghost);
    });

    window.addEventListener('mousemove', e => {
        if (!dragState) return;

        const { isResize, startX, startY, origColStart, origColEnd, origRowStart, origRowEnd, cellW, cellH } = dragState;
        const dx = Math.round((e.clientX - startX) / cellW);
        const dy = Math.round((e.clientY - startY) / cellH);

        const ghost = document.getElementById('drag-ghost');
        if (!ghost) return;

        if (isResize) {
            // Resize: change end positions
            let newColEnd = origColEnd + dx;
            let newRowEnd = origRowEnd + dy;
            // Min size
            if (newColEnd - origColStart < 2) newColEnd = origColStart + 2;
            if (newRowEnd - origRowStart < 1) newRowEnd = origRowStart + 1;
            // Max col
            if (newColEnd > 49) newColEnd = 49;
            ghost.style.gridColumnEnd = newColEnd;
            ghost.style.gridRowEnd = newRowEnd;
        } else {
            // Move: change start positions, keep size
            const w = origColEnd - origColStart;
            const h = origRowEnd - origRowStart;
            let newColStart = origColStart + dx;
            let newRowStart = origRowStart + dy;
            // Boundaries
            if (newColStart < 1) newColStart = 1;
            if (newColStart + w > 49) newColStart = 49 - w;
            if (newRowStart < 1) newRowStart = 1;

            ghost.style.gridColumnStart = newColStart;
            ghost.style.gridColumnEnd = newColStart + w;
            ghost.style.gridRowStart = newRowStart;
            ghost.style.gridRowEnd = newRowStart + h;
        }
    });

    window.addEventListener('mouseup', () => {
        if (!dragState) return;

        const ghost = document.getElementById('drag-ghost');
        if (ghost) {
            // Apply ghost position to item
            dragState.item.style.gridColumnStart = ghost.style.gridColumnStart;
            dragState.item.style.gridColumnEnd = ghost.style.gridColumnEnd;
            dragState.item.style.gridRowStart = ghost.style.gridRowStart;
            dragState.item.style.gridRowEnd = ghost.style.gridRowEnd;
            ghost.remove();
        }

        dragState.item.classList.remove('dragging');
        dragState = null;
    });
}

// ============================================================
// MODAL
// ============================================================
function openModal(title, bodyHtml, hideFooter = false) {
    modalTitleEl.textContent = title;
    modalBodyEl.innerHTML = bodyHtml;
    const footer = modalEl.querySelector('footer');
    if (footer) footer.style.display = hideFooter ? 'none' : 'flex';
    modalEl.classList.remove('hidden');
}

// ============================================================
// FILE BROWSER MODAL
// ============================================================
// BROWSER MODAL (Stacked)
// ============================================================
const browserModalEl = document.getElementById('browser-modal');
const browserModalTitleEl = document.getElementById('browser-modal-title');
const browserModalBodyEl = document.getElementById('browser-modal-body');

function openBrowserModal(title, bodyHtml) {
    if (browserModalTitleEl) browserModalTitleEl.textContent = title;
    if (browserModalBodyEl) browserModalBodyEl.innerHTML = bodyHtml;
    if (browserModalEl) browserModalEl.classList.remove('hidden');
}

function closeBrowserModal() {
    if (browserModalEl) browserModalEl.classList.add('hidden');
}

document.getElementById('browser-modal-close')?.addEventListener('click', closeBrowserModal);


// ============================================================
// FILE BROWSER MODAL (Generic)
// ============================================================
async function openSelectFileModal(onSelect, extensions = ['json'], title = 'Browse Files') {
    // Use the stacked browser modal
    openBrowserModal(title, `
        <div class="browser-bar" style="margin-bottom:1rem;display:flex;gap:10px;align-items:center;">
            <button id="modal-browser-up" class="btn-sm"><i class="fa-solid fa-level-up-alt"></i> Up</button>
            <div id="modal-path-display" style="font-family:monospace;font-size:0.9rem;color:var(--text-muted);">Loading...</div>
        </div>
        <div id="modal-file-list" style="height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:10px;">
                    Loading...
                </div>
            `);

    const listEl = document.getElementById('modal-file-list');
    const pathEl = document.getElementById('modal-path-display');
    const upBtn = document.getElementById('modal-browser-up');

    let currentPath = '';

    async function loadPath(path = '') {
        try {
            const extsParam = extensions.join(',');
            const res = await fetch(`api.php ? action = browse & path=${encodeURIComponent(path)}& exts=${extsParam} `);
            const data = await res.json();

            currentPath = data.current_path;
            pathEl.textContent = currentPath;
            listEl.innerHTML = '';

            // Up button logic
            upBtn.onclick = () => loadPath(currentPath + '/..');

            if (data.items.length === 0) {
                listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:1rem;">No files found</div>';
                return;
            }

            // List items
            data.items.forEach(item => {
                const row = document.createElement('div');
                row.style.cssText = 'padding:5px 10px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);';
                row.onmouseover = () => row.style.backgroundColor = 'var(--bg-hover)';
                row.onmouseout = () => row.style.backgroundColor = 'transparent';

                const icon = item.type === 'dir' ? '<i class="fa-solid fa-folder" style="color:#f59e0b;"></i>' : '<i class="fa-solid fa-file-code" style="color:var(--primary);"></i>';
                row.innerHTML = `${icon} <span>${item.name}</span>`;

                row.onclick = async () => {
                    if (item.type === 'dir') {
                        loadPath(item.path);
                    } else {
                        // Close browser modal FIRST
                        closeBrowserModal();
                        // Then call onSelect after a delay to ensure modal is fully closed
                        setTimeout(() => {
                            onSelect(item.path, currentPath);
                        }, 100);
                    }
                };
                listEl.appendChild(row);
            });

        } catch (e) {
            console.error(e);
            listEl.innerHTML = '<div style="color:red">Error loading files</div>';
        }
    }

    loadPath();
}

// ============================================================
// FILE BROWSER MODAL (Config)
// ============================================================
// ============================================================
// FILE BROWSER MODAL (Config)
// ============================================================
async function openFileBrowserModal() {
    openSelectFileModal(async (filename) => {
        if (confirm(`Load ${filename}? Unsaved changes will be lost.`)) {
            await loadConfigFile(filename);
            closeBrowserModal();
        }
    }, ['json'], 'Browse Config Files');
}

// ============================================================
// SAVE AS MODAL
// ============================================================
async function openSaveAsModal() {
    // Extract directory and filename from current target
    const lastSlash = state.targetFile.lastIndexOf('/');
    const initialDir = lastSlash > -1 ? state.targetFile.substring(0, lastSlash) : '';
    const initialFilename = lastSlash > -1 ? state.targetFile.substring(lastSlash + 1) : state.targetFile;

    openModal('Save As', `
        <div class="browser-bar" style="margin-bottom:1rem;display:flex;gap:10px;align-items:center;">
            <div id="modal-saveas-path" style="font-family:monospace;font-size:0.9rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Loading...</div>
        </div>
        <div id="modal-saveas-list" style="height:250px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:10px;margin-bottom:1rem;">
            Loading...
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
            <label style="color:var(--text-muted);">Filename:</label>
            <input type="text" id="modal-saveas-input" class="comp-input" style="flex:1;" placeholder="filename.json" value="${initialFilename}">
            <button id="modal-saveas-btn" class="btn-primary">Save</button>
        </div>
            `, true);

    const listEl = document.getElementById('modal-saveas-list');
    const pathEl = document.getElementById('modal-saveas-path');
    const inputEl = document.getElementById('modal-saveas-input');
    const saveBtn = document.getElementById('modal-saveas-btn');

    let currentPath = '';

    async function loadPath(path = '') {
        try {
            const res = await fetch(`api.php ? action = browse & path=${encodeURIComponent(path)} `);
            const data = await res.json();
            currentPath = data.current_path;
            pathEl.textContent = currentPath;
            pathEl.title = currentPath;
            listEl.innerHTML = '';

            if (data.items.length === 0) {
                listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:1rem;">No files found</div>';
            } else {
                data.items.forEach(item => {
                    const row = document.createElement('div');
                    row.style.cssText = 'padding:5px 10px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);';
                    row.onmouseover = () => row.style.backgroundColor = 'var(--bg-hover)';
                    row.onmouseout = () => row.style.backgroundColor = 'transparent';

                    const icon = item.type === 'dir'
                        ? '<i class="fa-solid fa-folder" style="color:#f59e0b;"></i>'
                        : '<i class="fa-solid fa-file-code" style="color:var(--primary);"></i>';

                    row.innerHTML = `${icon} <span>${item.name}</span>`;

                    row.onclick = () => {
                        if (item.type === 'dir') {
                            loadPath(item.path);
                        } else {
                            // Select file for overwrite
                            inputEl.value = item.name;
                        }
                    };
                    listEl.appendChild(row);
                });
            }
        } catch (e) {
            console.error(e);
            listEl.innerHTML = '<div style="color:red">Error loading files</div>';
        }
    }

    saveBtn.onclick = async () => {
        let filename = inputEl.value.trim();
        if (!filename) return alert('Please enter a filename.');
        if (!filename.toLowerCase().endsWith('.json')) filename += '.json';

        const exists = Array.from(listEl.querySelectorAll('span')).some(span => span.textContent === filename);
        if (exists) {
            if (!confirm(`File "${filename}" already exists.Overwrite ? `)) return;
        }

        // Construct full path: currentPath + filename
        const fullPath = currentPath ? currentPath + '/' + filename : filename;
        await saveConfig(fullPath);
        closeModal();
    };

    // Start at current file's directory
    loadPath(initialDir);
}


// ============================================================
// SAVE OPTIONS MODAL
// ============================================================
// ============================================================
// SAVE OPTIONS MODAL
// ============================================================
async function openSaveOptionsModal() {
    // Ensure targetFile has a value
    if (!state.targetFile) {
        state.targetFile = localStorage.getItem('yoAdminTargetFile') || fileInputEl?.value || 'admin_config.json';
        console.warn('[Save] targetFile was empty, recovered from storage:', state.targetFile);
    }

    console.log('[Save] Opening save options, targetFile:', state.targetFile);

    // Extract directory and filename from current target
    const lastSlash = state.targetFile.lastIndexOf('/');
    const initialDir = lastSlash > -1 ? state.targetFile.substring(0, lastSlash) : '';
    const initialFilename = lastSlash > -1 ? state.targetFile.substring(lastSlash + 1) : state.targetFile;

    // Fetch current directory path to display context
    let currentDir = initialDir || '(Current Directory)';
    try {
        const res = await fetch(`api.php?action=browse&path=${encodeURIComponent(initialDir)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.current_path) {
                currentDir = data.current_path;
                // Normalize slashes for display
                if (!currentDir.endsWith('/') && !currentDir.endsWith('\\')) {
                    currentDir += '/';
                }
            }
        }
    } catch (e) {
        console.error('[Save] Failed to fetch directory path:', e);
        // Keep the fallback value
    }

    openModal('Save Dashboard', `
        <div style="margin-bottom:1.5rem;">
            <div style="margin-bottom:1rem;">
                <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:0.3rem;">Save Location (Folder):</p>
                <div style="font-family:monospace;background-color:var(--bg-card);padding:0.5rem;border:1px solid var(--border);border-radius:4px;word-break:break-all;font-size:0.85rem;color:var(--text-muted);">
                    ${currentDir}
                </div>
            </div>
            <div>
                <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:0.3rem;">File Name:</p>
                <div style="font-family:monospace;background-color:var(--bg-card);padding:0.5rem;border:1px solid var(--border);border-radius:4px;font-size:1rem;font-weight:bold;">
                    ${initialFilename}
                </div>
            </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;">
            <button id="modal-opt-overwrite" class="btn-primary" style="padding:0.8rem 1.5rem;"><i class="fa-solid fa-save"></i> Overwrite</button>
            <button id="modal-opt-saveas" class="btn-primary" style="padding:0.8rem 1.5rem;background-color:var(--text-muted);border:none;"><i class="fa-solid fa-file-export"></i> Save As...</button>
        </div>
        <div style="text-align:center;margin-top:1rem;">
            <button id="modal-opt-cancel" style="background:none;border:none;color:var(--text-muted);cursor:pointer;text-decoration:underline;">Cancel</button>
        </div>
            `, true); // Hide default footer

    document.getElementById('modal-opt-overwrite').onclick = async () => {
        await saveConfig(null); // Overwrite current
        closeModal();
    };

    document.getElementById('modal-opt-saveas').onclick = () => {
        closeModal();
        openSaveAsModal();
    };

    document.getElementById('modal-opt-cancel').onclick = closeModal;
}

// ============================================================
// GLOBAL UTILITIES
// ============================================================
window.showLoading = function (text = 'Loading...') {
    const overlay = document.getElementById('global-loading');
    const textEl = document.getElementById('global-loading-text');
    if (overlay) {
        if (textEl) textEl.textContent = text;
        overlay.classList.remove('hidden');
    }
};

window.hideLoading = function () {
    const overlay = document.getElementById('global-loading');
    if (overlay) {
        overlay.classList.add('hidden');
    }
};

// ============================================================
// START
// ============================================================
init();
