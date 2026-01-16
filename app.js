// ============================================================
// yoAdmin Builder - App.js (v3)
// シンプルな12カラムCSS Gridベースの実装
// 外部ライブラリ不使用
// ============================================================

// --- State ---
const state = {
    config: [],
    selectedMenuId: null,
    selectedSubmenuId: null,
    activeTabId: null,
    targetFile: 'admin_config.json'
};

// --- DOM Elements ---
const menuTreeEl = document.getElementById('menu-tree');
const tabsEl = document.getElementById('tabs');
const gridEl = document.getElementById('grid');
const breadcrumbsEl = document.getElementById('breadcrumbs');
const emptyStateEl = document.getElementById('empty-state');
const workspaceEl = document.getElementById('workspace');
const toolboxEl = document.getElementById('toolbox');
const fileInputEl = document.getElementById('file-input');

// Modal
const modalEl = document.getElementById('modal');
const modalTitleEl = document.getElementById('modal-title');
const modalBodyEl = document.getElementById('modal-body');

// --- Grid Drag/Resize State ---
let dragState = null;
let currentEditComp = null; // For modal editing
let codeMirrorInstance = null; // CodeMirror editor instance

// ============================================================
// INITIALIZATION
// ============================================================
async function init() {
    await loadConfig();
    renderSidebar();
    setupEventListeners();
}

async function loadConfig() {
    try {
        // Prioritize URL param > Input Value (if changed by user, but init calls this once) > LocalStorage > Default
        // On init, input value is default "admin_config.json". We should check URL first.
        const urlParams = new URLSearchParams(window.location.search);
        const urlConfig = urlParams.get('config');

        // If URL has config, use it. Otherwise fall back to storage or default.
        // We ignore fileInputEl.value on initial load because it has a hardcoded default.
        const file = urlConfig || localStorage.getItem('yoAdminTargetFile') || 'admin_config.json';

        state.targetFile = file;
        fileInputEl.value = file;
        localStorage.setItem('yoAdminTargetFile', file);

        const res = await fetch(`api.php?file=${file}`);
        if (res.ok) {
            state.config = await res.json();
        } else {
            state.config = [];
        }
        // Reset selection on load
        state.selectedMenuId = null;
        state.selectedSubmenuId = null;
        state.activeTabId = null;
    } catch (e) {
        console.error('Load failed:', e);
        state.config = [];
    }
}

async function saveConfig() {
    syncCurrentTab();
    try {
        const formData = new FormData();
        formData.append('filename', state.targetFile);
        formData.append('config', JSON.stringify(state.config));
        const res = await fetch('api.php', { method: 'POST', body: formData });
        const json = await res.json();
        alert(json.success ? 'Saved!' : 'Save failed.');
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
        div.innerHTML = `
            <div class="menu-header">
                <span><i class="fa-solid fa-folder"></i> ${menu.title}</span>
                <button class="icon-btn add-sub" data-id="${menu.id}"><i class="fa-solid fa-plus"></i></button>
            </div>
            <div class="submenu-list">
                ${(menu.submenus || []).map(sub => `
                    <div class="submenu-item ${state.selectedSubmenuId === sub.id ? 'active' : ''}" data-menu="${menu.id}" data-sub="${sub.id}">${sub.title}</div>
                `).join('')}
            </div>
        `;
        menuTreeEl.appendChild(div);
    });
}

function renderTabs() {
    const submenu = getSubmenu();
    if (!submenu) return;

    // Render tabs with edit controls + add button
    let html = (submenu.tabs || []).map(t => `
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
    const pos = comp.labelPosition || 'left'; // 'left' or 'right'
    const flexClass = pos === 'right' ? 'label-right' : 'label-left';

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
            return `<div class="comp-html">${comp.content || '<em>HTML/JS</em>'}</div>`;
        default:
            return `<span>${label}</span>`;
    }
}

// ============================================================
// STATE HELPERS
// ============================================================
function getSubmenu() {
    const menu = state.config.find(m => m.id === state.selectedMenuId);
    return menu?.submenus?.find(s => s.id === state.selectedSubmenuId);
}

function getTab() {
    const sub = getSubmenu();
    return sub?.tabs?.find(t => t.id === state.activeTabId);
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

    // HTML-specific fields
    if (comp.type === 'html') {
        html += `
            <div class="settings-group">
                <label>Source:</label>
                <div class="html-editor-tabs">
                    <button class="html-tab ${!comp.content ? 'active' : ''}" data-mode="file">File Path</button>
                    <button class="html-tab ${comp.content ? 'active' : ''}" data-mode="direct">Direct Edit</button>
                </div>
            </div>
            <div id="file-mode" class="editor-mode ${!comp.content ? '' : 'hidden'}">
                <label>File Path:</label>
                <input type="text" id="html-file-path" placeholder="components/widget.html" value="${comp.filePath || ''}">
            </div>
            <div id="direct-mode" class="editor-mode ${comp.content ? '' : 'hidden'}">
                <label>HTML Content:</label>
                <textarea id="html-direct-content" rows="8">${comp.content || ''}</textarea>
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

    // Label position for labeled components
    if (['checkbox', 'toggle', 'input', 'datepicker'].includes(comp.type)) {
        html += `
            <div class="settings-group">
                <label>Label Position:</label>
                <select id="comp-label-position">
                    <option value="left" ${comp.labelPosition === 'left' ? 'selected' : ''}>Left</option>
                    <option value="right" ${comp.labelPosition === 'right' ? 'selected' : ''}>Right</option>
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

    modalEl.classList.remove('hidden');

    // Initialize CodeMirror for HTML type
    if (comp.type === 'html') {
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
    }
}

function handleModalConfirm() {
    if (!currentEditComp) return;

    // Common fields
    currentEditComp.customId = document.getElementById('comp-custom-id')?.value?.trim() || null;
    currentEditComp.customClass = document.getElementById('comp-custom-class')?.value?.trim() || null;
    currentEditComp.label = document.getElementById('comp-label')?.value?.trim() || currentEditComp.label;

    // HTML specific
    if (currentEditComp.type === 'html') {
        const filePath = document.getElementById('html-file-path')?.value?.trim();
        // Get content from CodeMirror if available, otherwise from textarea
        const directContent = codeMirrorInstance ? codeMirrorInstance.getValue() : document.getElementById('html-direct-content')?.value;
        if (filePath) {
            currentEditComp.filePath = filePath;
            currentEditComp.content = null;
        } else if (directContent) {
            currentEditComp.content = directContent;
            currentEditComp.filePath = null;
        }
    }

    // DatePicker specific
    if (currentEditComp.type === 'datepicker') {
        currentEditComp.includeTime = document.getElementById('comp-include-time')?.checked || false;
    }

    // Label position
    const labelPos = document.getElementById('comp-label-position')?.value;
    if (labelPos) currentEditComp.labelPosition = labelPos;

    closeModal();
    renderGrid();
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    // Add Menu
    document.getElementById('add-menu-btn').addEventListener('click', () => {
        const title = prompt('Menu title:');
        if (title) {
            state.config.push({ id: 'menu-' + Date.now(), title, submenus: [] });
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
    });

    // Tab selection (delegated)
    tabsEl.addEventListener('click', e => {
        // Delete Tab
        if (e.target.classList.contains('tab-close')) {
            e.stopPropagation();
            const tabId = e.target.closest('.tab').dataset.id;
            const sub = getSubmenu();

            if (sub.tabs.length <= 1) {
                alert('Cannot delete the last tab.');
                return;
            }

            if (confirm('Delete this tab?')) {
                sub.tabs = sub.tabs.filter(t => t.id !== tabId);
                if (state.activeTabId === tabId) {
                    state.activeTabId = sub.tabs[0].id; // Switch to first available
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
            const sub = getSubmenu();
            const tabData = sub.tabs.find(t => t.id === tabId);

            const newTitle = prompt('Rename tab:', tabData.title);
            if (newTitle && newTitle.trim() !== '') {
                tabData.title = newTitle.trim();
                renderTabs();
            }
            return;
        }

        // Add Tab (button is now inside tabs container)
        if (e.target.closest('#add-tab-btn')) {
            const sub = getSubmenu();
            if (!sub) return;
            const title = prompt('Tab title:');
            if (title) {
                const newId = 'tab-' + Date.now();
                sub.tabs.push({ id: newId, title, components: [] });
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
    document.getElementById('save-btn').addEventListener('click', saveConfig);

    // Load
    document.getElementById('load-btn').addEventListener('click', async () => {
        if (confirm('Load will discard unsaved changes. Continue?')) {
            await loadConfig();
            renderSidebar();
            emptyStateEl.classList.remove('hidden');
            workspaceEl.classList.add('hidden');
            toolboxEl.classList.add('hidden');
            breadcrumbsEl.textContent = 'Select a submenu';
        }
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-confirm').addEventListener('click', handleModalConfirm);

    // Toolbox Toggle
    document.getElementById('toolbox-toggle').addEventListener('click', () => {
        document.getElementById('toolbox').classList.toggle('collapsed');
    });

    // Grid Drag & Drop from Toolbox
    setupToolboxDnD();

    // Grid Item Drag/Resize
    setupGridInteraction();
}

function showWorkspace() {
    emptyStateEl.classList.add('hidden');
    workspaceEl.classList.remove('hidden');
    toolboxEl.classList.remove('hidden');
    const menu = state.config.find(m => m.id === state.selectedMenuId);
    const sub = getSubmenu();
    breadcrumbsEl.textContent = `${menu?.title} > ${sub?.title}`;

    // Ensure tabs array exists
    if (!sub.tabs) {
        sub.tabs = [];
    }

    // Auto-create default tab if none exists
    if (sub.tabs.length === 0) {
        const defaultTab = { id: 'tab-' + Date.now(), title: 'Main', components: [] };
        sub.tabs.push(defaultTab);
        console.log('Created default tab:', defaultTab);
    }

    // Always select first tab
    state.activeTabId = sub.tabs[0].id;
    console.log('showWorkspace - activeTabId:', state.activeTabId, 'tabs:', sub.tabs);

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
            datepicker: 'Calendar'
        };

        const newComp = {
            id: 'comp-' + Date.now(),
            type,
            label: typeLabels[type] || type,
            labelPosition: 'left', // 'left' or 'right'
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
}

// ============================================================
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
function openModal(title, bodyHtml) {
    modalTitleEl.textContent = title;
    modalBodyEl.innerHTML = bodyHtml;
    modalEl.classList.remove('hidden');
}

function closeModal() {
    modalEl.classList.add('hidden');
}

// ============================================================
// START
// ============================================================
init();
