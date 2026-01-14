
import { renderSidebar, renderTabs, renderComponent } from './render.js';

// State Management
const state = {
    menus: [],
    config: {
        filename: 'admin_config.json' // Default filename
    }
};

// Selection State
let selectedMenuId = null;
let selectedSubmenuId = null;
let activeTabId = null;

// DOM Elements
const menuListEl = document.getElementById('menu-list');
const workspaceEl = document.getElementById('workspace');
const emptyStateEl = document.getElementById('empty-state');
const breadcrumbsEl = document.getElementById('breadcrumbs');
const addMenuBtn = document.getElementById('add-menu-btn');
const tabsHeaderEl = document.getElementById('tabs-header');
const addTabBtn = document.getElementById('add-tab-btn');
const tabContentEl = document.getElementById('active-tab-content');
const toolBtns = document.querySelectorAll('.tool-btn');
// Modals
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const modalConfirmBtn = document.getElementById('modal-confirm');
const modalCancelBtn = document.getElementById('modal-cancel');
// Settings
const saveConfigBtn = document.getElementById('save-config-btn');
const configSettingsBtn = document.getElementById('config-settings-btn'); // Need to add this to HTML

// Modal State
let currentModalAction = null;

// Initialization
async function init() {
    await loadState();

    // Initial Render
    updateSidebar();

    // Event Listeners
    addMenuBtn.addEventListener('click', () => openModal('add-menu'));
    addTabBtn.addEventListener('click', () => openModal('add-tab'));
    modalCancelBtn.addEventListener('click', closeModal);
    modalConfirmBtn.addEventListener('click', handleModalConfirm);

    toolBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.type;
            addComponent(type);
        });
    });

    saveConfigBtn.addEventListener('click', saveStateToBackend);

    // Add Settings Button if missing
    if (!document.getElementById('config-settings-btn')) {
        const actionsDiv = document.querySelector('.actions');
        const btn = document.createElement('button');
        btn.id = 'config-settings-btn';
        btn.className = 'btn-secondary';
        btn.innerText = 'Settings';
        btn.style.marginRight = '0.5rem';
        btn.onclick = () => openModal('settings');
        actionsDiv.insertBefore(btn, saveConfigBtn);
    }
}

// Data Handling
async function loadState() {
    try {
        // First, check if we have a stored preference for which file to load? 
        // For simplicity, let's look for a 'config.json' which stores the target filename, 
        // OR just load the default. 
        // Let's assume we load 'admin_config.json' by default or what's in localStorage.

        let targetFile = localStorage.getItem('yoAdminTargetFile') || 'admin_config.json';
        state.config.filename = targetFile;

        const response = await fetch(`api.php?file=${targetFile}`);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                state.menus = data;
                updateSidebar();
                return;
            } else if (Array.isArray(data)) {
                state.menus = []; // empty array
                return;
            }
        }
    } catch (e) {
        console.log('No backend data found for ' + state.config.filename);
        state.menus = [];
    }
}

async function saveStateToBackend() {
    const targetFile = state.config.filename;
    localStorage.setItem('yoAdminTargetFile', targetFile);

    try {
        const response = await fetch(`api.php?file=${targetFile}`, {
            method: 'POST',
            body: JSON.stringify(state.menus)
        });
        const res = await response.text();
        alert(`Saved to ${targetFile}!`);
    } catch (e) {
        console.error('Backend save failed', e);
        alert('Save Failed');
    }
}

// Rendering Wrappers
function updateSidebar() {
    renderSidebar(menuListEl, state.menus, {
        selectedMenuId,
        selectedSubmenuId
    }, {
        onSelectMenu: (id) => {
            selectedMenuId = id;
            updateSidebar();
        },
        onAddSubmenu: (menuId) => {
            selectedMenuId = menuId;
            openModal('add-submenu');
        },
        onSelectSubmenu: (menuId, subId) => {
            selectedMenuId = menuId;
            selectedSubmenuId = subId;

            // Auto select tab
            const menu = state.menus.find(m => m.id === selectedMenuId);
            const sub = menu.submenus.find(s => s.id === selectedSubmenuId);
            if (!activeTabId && sub && sub.tabs.length > 0) {
                activeTabId = sub.tabs[0].id;
            } else if (sub && !sub.tabs.find(t => t.id === activeTabId)) {
                activeTabId = sub.tabs.length > 0 ? sub.tabs[0].id : null;
            }

            updateSidebar();
            updateWorkspace();
        }
    });
}

function updateWorkspace() {
    if (!selectedSubmenuId) {
        workspaceEl.classList.add('hidden');
        emptyStateEl.classList.remove('hidden');
        return;
    }

    const menu = state.menus.find(m => m.id === selectedMenuId);
    if (!menu) return;
    const submenu = menu.submenus.find(s => s.id === selectedSubmenuId);
    if (!submenu) {
        workspaceEl.classList.add('hidden');
        return;
    }

    workspaceEl.classList.remove('hidden');
    emptyStateEl.classList.add('hidden');

    breadcrumbsEl.innerText = `${menu.title} > ${submenu.title}`;

    renderTabs(tabsHeaderEl, submenu.tabs, activeTabId, {
        onSelectTab: (id) => {
            activeTabId = id;
            updateWorkspace();
        }
    });

    renderTabContent(submenu);
}

function renderTabContent(submenu) {
    tabContentEl.innerHTML = '';

    const tab = submenu.tabs.find(t => t.id === activeTabId);
    if (!tab) {
        tabContentEl.innerHTML = '<p style="color:var(--text-secondary)">No tabs. Add one!</p>';
        return;
    }

    tab.components.forEach((comp, index) => {
        const el = renderComponent(comp, index, {
            onDeleteComponent: (idx) => deleteComponent(idx)
        }, true); // true = isBuilder
        tabContentEl.appendChild(el);
    });
}

// Logic Actions
function addComponent(type) {
    if (!activeTabId) {
        alert("Please select or create a tab first.");
        return;
    }
    currentModalAction = { type: 'add-component', compType: type };
    if (type === 'html') openModal('add-html');
    else openModal('add-basic-comp');
}

function deleteComponent(index) {
    const menu = state.menus.find(m => m.id === selectedMenuId);
    const submenu = menu.submenus.find(s => s.id === selectedSubmenuId);
    const tab = submenu.tabs.find(t => t.id === activeTabId);
    tab.components.splice(index, 1);
    updateWorkspace(); // Don't auto save, wait for user
}

// Modal Logic
function openModal(actionType) {
    modalOverlay.classList.remove('hidden');
    if (typeof actionType === 'string') {
        if (!currentModalAction) currentModalAction = { type: actionType };
        else currentModalAction.type = actionType;
    }

    modalContent.innerHTML = '';

    if (currentModalAction.type === 'settings') {
        modalTitle.innerText = 'Settings';
        modalContent.innerHTML = `
            <div class="form-group">
                <label>Target JSON Filename</label>
                <input id="modal-filename" class="form-input" value="${state.config.filename}">
                <small style="color:var(--text-secondary)">This file will be used for saving/loading.</small>
            </div>
        `;
    } else if (currentModalAction.type === 'add-menu') {
        modalTitle.innerText = 'Add New Menu';
        modalContent.innerHTML = '<div class="form-group"><label>Menu Title</label><input id="modal-input" class="form-input" autofocus></div>';
    } else if (currentModalAction.type === 'add-submenu') {
        modalTitle.innerText = 'Add Submenu';
        modalContent.innerHTML = '<div class="form-group"><label>Submenu Title</label><input id="modal-input" class="form-input" autofocus></div>';
    } else if (currentModalAction.type === 'add-tab') {
        modalTitle.innerText = 'Add Tab';
        modalContent.innerHTML = '<div class="form-group"><label>Tab Title</label><input id="modal-input" class="form-input" autofocus></div>';
    } else if (currentModalAction.type === 'add-basic-comp') {
        const label = currentModalAction.compType === 'button' ? 'Button Text' : 'Label';
        modalTitle.innerText = `Add ${currentModalAction.compType}`;
        modalContent.innerHTML = `<div class="form-group"><label>${label}</label><input id="modal-input" class="form-input" autofocus></div>`;
    } else if (currentModalAction.type === 'add-html') {
        modalTitle.innerText = 'Add Custom HTML/JS';
        modalContent.innerHTML = `
            <div class="form-group">
                <label>HTML Content</label>
                <textarea id="modal-html" class="code-editor" placeholder="<div>Hello World</div>"></textarea>
            </div>
            <div class="form-group">
                <label>Javascript (Optional)</label>
                <textarea id="modal-js" class="code-editor" placeholder="console.log('loaded')"></textarea>
            </div>
        `;
    }
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    currentModalAction = null;
}

function handleModalConfirm() {
    if (!currentModalAction) return;

    if (currentModalAction.type === 'settings') {
        const filename = document.getElementById('modal-filename').value;
        if (filename) {
            state.config.filename = filename;
            // Optionally reload?
            if (confirm("Reload with new file? Unsaved changes will be lost.")) {
                localStorage.setItem('yoAdminTargetFile', filename);
                location.reload();
            }
        }
    } else if (['add-menu', 'add-submenu', 'add-tab', 'add-basic-comp'].includes(currentModalAction.type)) {
        const input = document.getElementById('modal-input');
        if (!input.value) return;
        const val = input.value;

        if (currentModalAction.type === 'add-menu') {
            state.menus.push({
                id: 'menu-' + Date.now(),
                title: val,
                submenus: []
            });
            updateSidebar();
        } else if (currentModalAction.type === 'add-submenu') {
            const menu = state.menus.find(m => m.id === selectedMenuId);
            const newSub = { id: 'sub-' + Date.now(), title: val, tabs: [] };
            menu.submenus.push(newSub);
            updateSidebar();
            // Trigger selection of this new submenu
            // ... manual implementation ...
        } else if (currentModalAction.type === 'add-tab') {
            const menu = state.menus.find(m => m.id === selectedMenuId);
            const submenu = menu.submenus.find(s => s.id === selectedSubmenuId);
            const newTab = { id: 'tab-' + Date.now(), title: val, components: [] };
            submenu.tabs.push(newTab);
            activeTabId = newTab.id;
            updateWorkspace();
        } else if (currentModalAction.type === 'add-basic-comp') {
            const menu = state.menus.find(m => m.id === selectedMenuId);
            const submenu = menu.submenus.find(s => s.id === selectedSubmenuId);
            const tab = submenu.tabs.find(t => t.id === activeTabId);
            tab.components.push({ type: currentModalAction.compType, label: val });
            updateWorkspace();
        }
    } else if (currentModalAction.type === 'add-html') {
        const html = document.getElementById('modal-html').value;
        const js = document.getElementById('modal-js').value;
        const menu = state.menus.find(m => m.id === selectedMenuId);
        const submenu = menu.submenus.find(s => s.id === selectedSubmenuId);
        const tab = submenu.tabs.find(t => t.id === activeTabId);
        tab.components.push({ type: 'html', code: html, script: js });
        updateWorkspace();
    }

    closeModal();
}

// Start
init();
