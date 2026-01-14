
// Render Logic - Pure Rendering functions
export function renderSidebar(menuListEl, menus, activeState, callbacks) {
    if (!menuListEl) return;
    menuListEl.innerHTML = '';

    menus.forEach(menu => {
        const menuEl = document.createElement('div');
        menuEl.className = 'menu-item';

        // Menu Header
        const header = document.createElement('div');
        const isActive = activeState.selectedMenuId === menu.id;
        header.className = `menu-header ${isActive ? 'active' : ''}`;

        let headerContent = `<span>${menu.title}</span>`;
        if (callbacks.onAddSubmenu) {
            headerContent += `<button class="icon-btn" style="width:20px;height:20px;font-size:12px;" data-action="add-submenu" data-id="${menu.id}">+</button>`;
        }
        header.innerHTML = headerContent;

        header.onclick = () => callbacks.onSelectMenu(menu.id);

        if (callbacks.onAddSubmenu) {
            const btn = header.querySelector('[data-action="add-submenu"]');
            if (btn) {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    callbacks.onAddSubmenu(menu.id);
                }
            }
        }

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

export function renderTabs(tabsHeaderEl, tabs, activeTabId, callbacks) {
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

export function renderComponent(comp, index, callbacks, isBuilder = false) {
    const wrapper = document.createElement('div');
    wrapper.className = isBuilder ? 'component-wrapper' : 'component-wrapper-static';

    // Controls (Only for Builder)
    if (isBuilder && callbacks.onDeleteComponent) {
        const controls = document.createElement('div');
        controls.className = 'component-controls';
        const delBtn = document.createElement('button');
        delBtn.className = 'ctrl-btn';
        delBtn.innerText = 'DELETE';
        delBtn.onclick = () => callbacks.onDeleteComponent(index);
        controls.appendChild(delBtn);
        wrapper.appendChild(controls);
    }

    // Content
    if (comp.type === 'input') {
        const id = `inp-${Date.now()}-${index}`; // unique-ish
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
        // Script execution
        if (comp.script && !isBuilder) { // execute script primarily in viewer
            try {
                const fn = new Function(comp.script);
                setTimeout(() => fn(), 0);
            } catch (e) {
                console.error("Custom Script Error", e);
            }
        } else if (comp.script && isBuilder) {
            // In builder, maybe we want to run it too, but be careful?
            // Let's run it so they can preview.
            try {
                const fn = new Function(comp.script);
                setTimeout(() => fn(), 0);
            } catch (e) {
                console.error("Custom Script Error (Builder)", e);
            }
        }
        wrapper.appendChild(container);
    }

    return wrapper;
}
