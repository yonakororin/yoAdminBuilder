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
        const file = fileInputEl.value || localStorage.getItem('yoAdminTargetFile') || 'admin_config.json';
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
    tabsEl.innerHTML = (submenu.tabs || []).map(t =>
        `<div class="tab ${state.activeTabId === t.id ? 'active' : ''}" data-id="${t.id}">${t.title}</div>`
    ).join('');
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

    el.innerHTML = `
        <div class="item-header"><i class="fa-solid fa-grip-lines"></i></div>
        <div class="item-content">${comp.label || comp.type || 'Widget'}</div>
        <div class="resize-handle"></div>
    `;
    return el;
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
        const tab = e.target.closest('.tab');
        if (tab) {
            syncCurrentTab();
            state.activeTabId = tab.dataset.id;
            renderTabs();
            renderGrid();
        }
    });

    // Add Tab
    document.getElementById('add-tab-btn').addEventListener('click', () => {
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
        const cellW = rect.width / 12;
        const cellH = 44; // 40 + 4 gap
        const x = Math.floor((e.clientX - rect.left) / cellW);
        const y = Math.floor((e.clientY - rect.top) / cellH);
        console.log('Calculated position:', x, y);

        const newComp = {
            id: 'comp-' + Date.now(),
            type,
            label: type.charAt(0).toUpperCase() + type.slice(1),
            x: Math.max(0, Math.min(x, 8)), // Keep in bounds
            y: Math.max(0, y),
            w: 4,
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

        const isResize = e.target.classList.contains('resize-handle');
        const isHeader = e.target.closest('.item-header');

        if (!isResize && !isHeader) return;

        e.preventDefault();
        const rect = gridEl.getBoundingClientRect();
        const cellW = rect.width / 12;
        const cellH = 44;

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
            if (newColEnd > 13) newColEnd = 13;
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
            if (newColStart + w > 13) newColStart = 13 - w;
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
