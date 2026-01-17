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
            state.config = await res.json();
        } else {
            console.warn('File not found or empty, starting with empty config');
            state.config = [];
        }
    } catch (e) {
        console.error('Load failed:', e);
        state.config = [];
    }

    // Reset selection
    state.selectedMenuId = null;
    state.selectedSubmenuId = null;
    state.activeTabId = null;

    renderSidebar();

    // Reset UI to empty state
    emptyStateEl.classList.remove('hidden');
    workspaceEl.classList.add('hidden');
    toolboxEl.classList.add('hidden');
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
        formData.append('config', JSON.stringify(state.config));
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
            return `<div class="comp-html">${comp.content || '<em>HTML/JS</em>'}</div>`;
        case 'checklist': {
            const items = comp.items || ['Option 1', 'Option 2', 'Option 3'];
            const mode = comp.checklistMode || 'multi'; // 'single' (radio behavior) or 'multi' (checkbox)
            const inputType = mode === 'single' ? 'radio' : 'checkbox';
            const nameAttr = mode === 'single' ? `name="chk-${comp.id}"` : '';

            let listHtml = items.map((item, idx) => `
                <label class="checklist-item" style="display:flex;align-items:center;gap:6px;margin-bottom:4px;cursor:pointer;">
                    <input type="${inputType}" ${nameAttr} id="${comp.id}-${idx}" style="margin:0;width:auto;cursor:pointer;">
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
                    <i class="fa-solid fa-spinner" style="font-size:1.5rem;margin-bottom:0.5rem;"></i>
                    <div style="font-weight:600;">LOADING</div>
                    <div style="font-size:0.7rem;">ID: ${comp.customId || '(No ID)'}</div>
                </div>
            `;
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
                <input type="text" id="comp-button-onclick" placeholder="alert('Hello')" value="${(comp.onClick || '').replace(/"/g, '&quot;')}">
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
                <input type="text" id="html-file-path" placeholder="components/widget.html" value="${comp.filePath || ''}">
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
                    <option value="multi" ${(!comp.checklistMode || comp.checklistMode === 'multi') ? 'selected' : ''}>Multi Select (Checkbox)</option>
                    <option value="single" ${(comp.checklistMode === 'single') ? 'selected' : ''}>Single Select (Toggle/Radio)</option>
                </select>
            </div>
            <div class="settings-group">
                <label>Items (one per line):</label>
                <textarea id="comp-checklist-items" rows="5" placeholder="Item 1\nItem 2">${(comp.items || []).join('\n')}</textarea>
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
    }
}

function handleModalConfirm() {
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

    // HTML/Modal specific
    if (currentEditComp.type === 'html' || currentEditComp.type === 'modal') {
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
    document.getElementById('save-btn').addEventListener('click', openSaveOptionsModal);
    // Removed save-as-btn listener
    // document.getElementById('save-as-btn').addEventListener('click', openSaveAsModal);

    // Browse
    document.getElementById('browse-btn').addEventListener('click', openFileBrowserModal);

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
function openModal(title, bodyHtml, hideFooter = false) {
    modalTitleEl.textContent = title;
    modalBodyEl.innerHTML = bodyHtml;
    const footer = modalEl.querySelector('footer');
    if (footer) footer.style.display = hideFooter ? 'none' : 'flex';
    modalEl.classList.remove('hidden');
}

function closeModal() {
    modalEl.classList.add('hidden');
}

// ============================================================
// FILE BROWSER MODAL
// ============================================================
async function openFileBrowserModal() {
    openModal('Browse Files', `
        <div class="browser-bar" style="margin-bottom:1rem;display:flex;gap:10px;align-items:center;">
            <button id="modal-browser-up" class="btn-sm"><i class="fa-solid fa-level-up-alt"></i> Up</button>
            <div id="modal-path-display" style="font-family:monospace;font-size:0.9rem;color:var(--text-muted);">Loading...</div>
        </div>
        <div id="modal-file-list" style="height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:10px;">
            Loading...
        </div>
    `, true);

    // Hide default modal buttons for this custom view if desired, or reuse them. 
    // We'll hide the OK/Cancel footer for now or assume they are just for closing?
    // Actually our openModal puts content in body. Footer remains.
    // Let's modify loadPath logic to populate this.

    const listEl = document.getElementById('modal-file-list');
    const pathEl = document.getElementById('modal-path-display');
    const upBtn = document.getElementById('modal-browser-up');

    let currentPath = '';

    async function loadPath(path = '') {
        try {
            const res = await fetch(`api.php?action=browse&path=${encodeURIComponent(path)}`);
            const data = await res.json();

            currentPath = data.current_path;
            pathEl.textContent = currentPath;
            listEl.innerHTML = '';

            // Up button logic
            upBtn.onclick = () => loadPath(currentPath + '/..');

            if (data.items.length === 0) {
                listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:1rem;">No JSON files found</div>';
                return;
            }

            // Grid style for modal? or list? List is better for small modal.
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
                        // File selected
                        if (confirm(`Load ${item.name}? Unsaved changes will be lost.`)) {
                            // We need to pass the simple filename if in root, or handle full path if supported.
                            // Currently manualLoad uses fileInput value. 
                            // api.php?file=... works with relative or absolute provided validation allows it.
                            // Dashboard uses item.name (filename).
                            // Let's assume we are working with filenames in the ROOT directory for now as per api.php default.
                            // But if we browse deeper, we might get full path issues.
                            // Simple fix: just use the name if we want to stay consistent with dashboard.
                            // But wait, dashboard uses builder.php?config=FILENAME.
                            // So let's use item.name here too.

                            await loadConfigFile(item.name);
                            closeModal();
                        }
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
// SAVE AS MODAL
// ============================================================
async function openSaveAsModal() {
    openModal('Save As', `
        <div class="browser-bar" style="margin-bottom:1rem;display:flex;gap:10px;align-items:center;">
            <button id="modal-saveas-up" class="btn-sm"><i class="fa-solid fa-level-up-alt"></i> Up</button>
            <div id="modal-saveas-path" style="font-family:monospace;font-size:0.9rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Loading...</div>
        </div>
        <div id="modal-saveas-list" style="height:250px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:10px;margin-bottom:1rem;">
            Loading...
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
            <label style="color:var(--text-muted);">Filename:</label>
            <input type="text" id="modal-saveas-input" class="comp-input" style="flex:1;" placeholder="filename.json" value="${state.targetFile}">
            <button id="modal-saveas-btn" class="btn-primary">Save</button>
        </div>
    `, true);

    const listEl = document.getElementById('modal-saveas-list');
    const pathEl = document.getElementById('modal-saveas-path');
    const upBtn = document.getElementById('modal-saveas-up');
    const inputEl = document.getElementById('modal-saveas-input');
    const saveBtn = document.getElementById('modal-saveas-btn');

    let currentPath = '';

    async function loadPath(path = '') {
        try {
            const res = await fetch(`api.php?action=browse&path=${encodeURIComponent(path)}`);
            const data = await res.json();
            currentPath = data.current_path;
            pathEl.textContent = currentPath;
            pathEl.title = currentPath;
            listEl.innerHTML = '';

            upBtn.onclick = () => loadPath(currentPath + '/..');

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

        // Confirm overwrite if exists in list
        // Note: This check relies on currently loaded list. 
        // If file exists but not in list (e.g. race condition), api.php will overwrite anyway.
        // We can do a client-side check against the loaded items.
        // But simply confirmation is enough for "Save As".

        // Actually, let's just confirm if "Save As" is same as current target?
        // No, standard behavior is overwrite confirmation if file exists.

        // Check if file is in the current list
        // (We don't have the list data readily available unless we store it or query DOM)
        // Let's query DOM for simplicity or just proceed. 
        // A simple "Are you sure?" for Save As is often good practice?
        // Or strictly check existence.
        // Let's try to check existence by name.
        const exists = Array.from(listEl.querySelectorAll('span')).some(span => span.textContent === filename);
        if (exists) {
            if (!confirm(`File "${filename}" already exists. Overwrite?`)) return;
        }

        await saveConfig(filename);
        closeModal();
    };

    loadPath();
}

// ============================================================
// SAVE OPTIONS MODAL
// ============================================================
// ============================================================
// SAVE OPTIONS MODAL
// ============================================================
async function openSaveOptionsModal() {
    // Fetch current directory path to display context
    let currentDir = 'Loading...';
    try {
        const res = await fetch('api.php?action=browse');
        const data = await res.json();
        currentDir = data.current_path;
        // Normalize slashes for display
        if (!currentDir.endsWith('/') && !currentDir.endsWith('\\')) {
            currentDir += '/';
        }
    } catch (e) {
        currentDir = '';
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
                    ${state.targetFile}
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
// START
// ============================================================
init();
