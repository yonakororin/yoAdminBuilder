<?php 
require_once 'auth.php'; 

// 権限チェック（権限がない場合は403エラー）
require_once __DIR__ . '/../shared/permission_check.php';
check_page_permission();

// Include centralized path configuration
// Use local config if exists, otherwise use default relative path
$_paths_config = file_exists(__DIR__ . '/mng_paths_local.php') 
    ? include(__DIR__ . '/mng_paths_local.php') 
    : ['paths_php' => dirname(__DIR__) . '/shared/paths.php'];
require_once $_paths_config['paths_php'];
$paths = MngPaths::getInstance();
unset($_paths_config);

// Load Admin Config for Theme
$config_param = isset($_GET['config']) ? $_GET['config'] : 'admin_config.json';
$config_path = $config_param;
if (!preg_match('/^(\/|[a-zA-Z]:)/', $config_param)) {
    $config_path = __DIR__ . '/' . $config_param;
}
$config_path = realpath($config_path) ?: $config_path;

$admin_config = [];
if (file_exists($config_path)) {
    $decoded = json_decode(file_get_contents($config_path), true);
    if (is_array($decoded)) {
        $admin_config = $decoded;
        // Support legacy array format (menus array) vs object format
        if (isset($admin_config[0])) { 
            $admin_config = ['menus' => $admin_config]; // normalization
        }
    }
}

// Configurable back button URL (defaults to yoAdminPortal)
$back_url = $admin_config['back_url'] ?? '../yoAdminPortal/viewer.php';
$back_label = $admin_config['back_label'] ?? 'ポータルに戻る';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>yoAdmin Viewer</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="<?= $paths->getUrl('shared') ?>/theme.css">
    <link rel="stylesheet" href="style.css">
    <?= mng_js_paths() ?>
    <script>
        window.mngConfig = <?= json_encode([
            'target_env' => $admin_config['target_env'] ?? (isset($_GET['env']) ? str_replace('web-', '', $_GET['env']) : 'dev'),
            'base_color' => $admin_config['base_color'] ?? null,
            'debug_path' => $config_path
        ]) ?>;
    </script>
    <script src="<?= $paths->getUrl('shared') ?>/theme.js"></script>
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
        .item-content { padding: 0; height: 100%; overflow: auto; }
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
        </aside>
        <main class="main">
            <header class="header">
                <div id="breadcrumbs" class="breadcrumbs">Select a submenu</div>
                <div class="header-right">
                    <a href="<?= htmlspecialchars($back_url) ?>" class="back-btn" title="<?= htmlspecialchars($back_label) ?>">
                        <i class="fa-solid fa-arrow-left"></i>
                        <span><?= htmlspecialchars($back_label) ?></span>
                    </a>
                    <div class="user-menu">
                    <button class="user-menu-btn" id="user-menu-btn">
                        <i class="fa-solid fa-user-circle"></i>
                        <span><?= htmlspecialchars($_SESSION['user'] ?? 'User') ?></span>
                        <i class="fa-solid fa-chevron-down" style="font-size:0.6rem;"></i>
                    </button>
                    <div class="user-menu-dropdown" id="user-menu-dropdown">

                        <a href="../yoSSO/change_password.php?redirect_uri=<?php echo urlencode($_SERVER['REQUEST_URI']); ?>" class="user-menu-item">
                            <i class="fa-solid fa-key"></i>
                            <span>Change Password</span>
                        </a>
                        <a href="logout.php?next=<?php echo urlencode($_SERVER['REQUEST_URI']); ?>" class="user-menu-item">
                            <i class="fa-solid fa-sign-out-alt"></i>
                            <span>Logout</span>
                        </a>
                    </div>
                </div>
            </div>
            </header>
            <div id="empty-state" class="empty-state"><p>Select a submenu to view.</p></div>
            <div id="workspace" class="workspace hidden">
                <div id="global-header-wrapper" class="global-header-wrapper">
                    <div id="global-header" class="global-area"></div>
                    <div class="global-header-toggle" onclick="toggleGlobalHeader()">
                        <i class="fa-solid fa-caret-up" id="global-header-toggle-icon"></i>
                    </div>
                </div>
                <div class="tabs-bar">
                    <div id="tabs" class="tabs"></div>
                </div>
                <div class="grid-container">
                    <div id="grid" class="grid"></div>
                </div>
                <div id="global-footer" class="global-area"></div>
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
        
        // Toggle global header visibility
        function toggleGlobalHeader() {
            const wrapper = document.getElementById('global-header-wrapper');
            const icon = document.getElementById('global-header-toggle-icon');
            const header = document.getElementById('global-header');
            
            if (wrapper.classList.contains('collapsed')) {
                wrapper.classList.remove('collapsed');
                icon.className = 'fa-solid fa-caret-up';
                header.style.display = '';
            } else {
                wrapper.classList.add('collapsed');
                icon.className = 'fa-solid fa-caret-down';
                header.style.display = 'none';
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
                        originalData: [], // Keep original for filtering
                        searchQuery: '',
                        page: 1,
                        pageSize: parseInt(el?.dataset.pagesize) || 10,
                        columns: JSON.parse(el?.dataset.columns || '[]'),
                        columnKeys: JSON.parse(el?.dataset.columnKeys || '[]'),
                        sortColumn: null,
                        sortDirection: 'asc' // 'asc' or 'desc'
                    };
                }
                return this._state[tableId];
            },
            
            setData(tableId, data) {
                const st = this._getState(tableId);
                st.originalData = Array.isArray(data) ? [...data] : [];
                st.data = [...st.originalData];
                st.searchQuery = '';
                st.page = 1;
                // Auto-fit page size to container
                this.autoFitPageSize(tableId);
                this.refresh(tableId);
            },
            
            // Search/filter data (supports regex with /pattern/ syntax)
            search(tableId, query) {
                const st = this._getState(tableId);
                st.searchQuery = query.trim();
                
                if (!st.searchQuery) {
                    st.data = [...st.originalData];
                } else {
                    // Check if regex pattern (starts and ends with /)
                    let regex = null;
                    if (st.searchQuery.startsWith('/') && st.searchQuery.lastIndexOf('/') > 0) {
                        const lastSlash = st.searchQuery.lastIndexOf('/');
                        const pattern = st.searchQuery.slice(1, lastSlash);
                        const flags = st.searchQuery.slice(lastSlash + 1) || 'i';
                        try {
                            regex = new RegExp(pattern, flags);
                        } catch (e) {
                            console.warn('[yoTable] Invalid regex:', e.message);
                            regex = null;
                        }
                    }
                    
                    const lowerQuery = st.searchQuery.toLowerCase();
                    
                    st.data = st.originalData.filter(row => {
                        return st.columns.some(col => {
                            const val = Array.isArray(row) ? row[st.columns.indexOf(col)] : row[col];
                            const strVal = String(val ?? '');
                            
                            if (regex) {
                                return regex.test(strVal);
                            } else {
                                return strVal.toLowerCase().includes(lowerQuery);
                            }
                        });
                    });
                }
                
                st.page = 1;
                this.autoFitPageSize(tableId);
                this.refresh(tableId);
            },
            
            // Handle search input
            _onSearchInput(tableId, event) {
                this.search(tableId, event.target.value);
            },
            
            // Download table data
            download(tableId, format) {
                const st = this._getState(tableId);
                const el = document.getElementById(tableId);
                const label = el?.dataset.label || 'table';
                const filename = `${label}_${new Date().toISOString().slice(0,10)}`;
                
                let content, mimeType, ext;
                
                switch(format) {
                    case 'csv':
                        content = this._toCSV(st.originalData, st.columns, ',', st.columnKeys);
                        mimeType = 'text/csv';
                        ext = 'csv';
                        break;
                    case 'tsv':
                        content = this._toCSV(st.originalData, st.columns, '\t', st.columnKeys);
                        mimeType = 'text/tab-separated-values';
                        ext = 'tsv';
                        break;
                    case 'json':
                        content = JSON.stringify(st.originalData, null, 2);
                        mimeType = 'application/json';
                        ext = 'json';
                        break;
                    default:
                        return;
                }
                
                const blob = new Blob([content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}.${ext}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            },
            
            // Convert data to CSV/TSV format
            _toCSV(data, columns, separator, columnKeys = []) {
                const header = columns.join(separator);
                const rows = data.map(row => {
                    return columns.map((col, colIdx) => {
                        const key = (columnKeys && columnKeys.length > colIdx && columnKeys[colIdx]) 
                            ? columnKeys[colIdx] 
                            : col;
                        
                        // Handle both array-based rows (by index) and object-based rows (by key/col name)
                        // If row is array, use colIdx. If object, use key.
                        const val = Array.isArray(row) ? row[colIdx] : (row[key] ?? '');
                        
                        let str = String(val ?? '');
                        // Escape quotes and wrap in quotes if contains separator or newline
                        if (str.includes(separator) || str.includes('\n') || str.includes('"')) {
                            str = '"' + str.replace(/"/g, '""') + '"';
                        }
                        return str;
                    }).join(separator);
                });
                return header + '\n' + rows.join('\n');
            },
            
            // Export to Google Spreadsheet
            async exportToGoogleSheet(tableId) {
                const st = this._getState(tableId);
                const el = document.getElementById(tableId);
                const label = el?.dataset.label || 'table';
                
                // Prompt for spreadsheet details
                const spreadsheetId = prompt('Google Spreadsheet ID を入力してください:');
                if (!spreadsheetId) return;
                
                const sheetName = prompt('シート名を入力してください:', label);
                if (!sheetName) return;
                
                // Convert data to CSV
                const csvContent = this._toCSV(st.originalData, st.columns, ',', st.columnKeys);
                
                // Send to backend
                try {
                    const response = await fetch('api.php?action=exportToGoogleSheet', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            spreadsheetId: spreadsheetId,
                            sheetName: sheetName,
                            csvData: csvContent
                        })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        alert('Google Spreadsheet へのエクスポートが完了しました');
                    } else {
                        alert('エラー: ' + (result.error || 'Unknown error'));
                    }
                } catch (e) {
                    alert('エクスポートに失敗しました: ' + e.message);
                }
            },
            
            // Calculate and set page size based on available container height
            autoFitPageSize(tableId) {
                const el = document.getElementById(tableId);
                if (!el) return;
                
                const st = this._getState(tableId);
                const container = el.closest('.item-content') || el.parentElement;
                if (!container) return;
                
                // Get container height
                const containerHeight = container.clientHeight;
                
                // Reserve space for header (approx 40px) and pagination (approx 50px)
                const headerHeight = 40;
                const paginationHeight = 50;
                const availableHeight = containerHeight - headerHeight - paginationHeight;
                
                // Estimate row height (approx 35px per row)
                const rowHeight = 35;
                
                // Calculate how many rows can fit
                const fittingRows = Math.max(1, Math.floor(availableHeight / rowHeight));
                
                console.log('[yoTable] autoFit:', tableId, 'container:', containerHeight, 'available:', availableHeight, 'rows:', fittingRows);
                
                st.pageSize = fittingRows;
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
            
            // Sort by column
            sortBy(tableId, column) {
                const st = this._getState(tableId);
                
                // Toggle direction if same column, otherwise reset to asc
                if (st.sortColumn === column) {
                    st.sortDirection = st.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    st.sortColumn = column;
                    st.sortDirection = 'asc';
                }
                
                // Get the data key for this column
                const colIdx = st.columns.indexOf(column);
                const dataKey = (st.columnKeys && st.columnKeys.length > colIdx && st.columnKeys[colIdx]) 
                    ? st.columnKeys[colIdx] 
                    : column;
                
                // Sort data
                st.data.sort((a, b) => {
                    let valA = Array.isArray(a) ? a[colIdx] : a[dataKey];
                    let valB = Array.isArray(b) ? b[colIdx] : b[dataKey];
                    
                    // Handle null/undefined
                    if (valA == null) valA = '';
                    if (valB == null) valB = '';
                    
                    // Numeric comparison
                    if (!isNaN(valA) && !isNaN(valB)) {
                        valA = Number(valA);
                        valB = Number(valB);
                    }
                    
                    let result = 0;
                    if (valA < valB) result = -1;
                    else if (valA > valB) result = 1;
                    
                    return st.sortDirection === 'asc' ? result : -result;
                });
                
                st.page = 1;
                this.refresh(tableId);
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
                if (!el) {
                    console.error(`[yoTable] Table with ID "${tableId}" not found.`);
                    return;
                }
                console.log('[yoTable] refresh - el:', el, 'outerHTML:', el.outerHTML.substring(0, 200));
                
                const thead = el.querySelector('thead tr');
                const tbody = el.querySelector('tbody');
                const pageInfo = el.querySelector('.page-info');
                const maxPage = Math.ceil(st.data.length / st.pageSize) || 1;
                
                // Update header with sort indicators
                if (thead) {
                    thead.innerHTML = st.columns.map(col => {
                        let sortIcon = '';
                        if (st.sortColumn === col) {
                            sortIcon = st.sortDirection === 'asc' 
                                ? ' <i class="fa-solid fa-sort-up"></i>' 
                                : ' <i class="fa-solid fa-sort-down"></i>';
                        } else {
                            sortIcon = ' <i class="fa-solid fa-sort" style="opacity:0.3;"></i>';
                        }
                        return `<th onclick="yoTable.sortBy('${tableId}','${col}')" style="cursor:pointer;">${col}${sortIcon}</th>`;
                    }).join('');
                }
                
                // Update page info
                if (pageInfo) {
                    pageInfo.textContent = `Page ${st.page} / ${maxPage} (${st.data.length} items)`;
                }
                
                // Update or create header with label and search input
                let tableHeader = el.querySelector('.comp-table-header');
                if (!tableHeader) {
                    tableHeader = document.createElement('div');
                    tableHeader.className = 'comp-table-header';
                    const tableLabel = el.dataset.label || '';
                    console.log('[yoTable] Creating header for', tableId, 'label:', tableLabel, 'dataset:', el.dataset);
                    tableHeader.innerHTML = `
                        <span class="comp-table-title">${tableLabel}</span>
                        <div class="comp-table-controls">
                            <input type="text" class="comp-table-search-input" placeholder="Search..." 
                                oninput="yoTable._onSearchInput('${tableId}', event)"
                                value="${st.searchQuery}">
                            <div class="comp-table-download-dropdown">
                                <button class="comp-table-download-btn" onclick="this.parentElement.classList.toggle('open')">
                                    <i class="fa-solid fa-file-export"></i> Export
                                </button>
                                <div class="comp-table-download-menu">
                                    <div onclick="yoTable.download('${tableId}','csv'); this.closest('.comp-table-download-dropdown').classList.remove('open');">
                                        <i class="fa-solid fa-file-csv"></i> CSV
                                    </div>
                                    <div onclick="yoTable.download('${tableId}','tsv'); this.closest('.comp-table-download-dropdown').classList.remove('open');">
                                        <i class="fa-solid fa-file-lines"></i> TSV
                                    </div>
                                    <div onclick="yoTable.download('${tableId}','json'); this.closest('.comp-table-download-dropdown').classList.remove('open');">
                                        <i class="fa-solid fa-file-code"></i> JSON
                                    </div>
                                    <div class="comp-table-menu-separator"></div>
                                    <div onclick="yoTable.exportToGoogleSheet('${tableId}'); this.closest('.comp-table-download-dropdown').classList.remove('open');">
                                        <i class="fa-brands fa-google-drive"></i> Google Spreadsheet
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    el.insertBefore(tableHeader, el.firstChild);
                }
                
                // Render rows for current page
                const start = (st.page - 1) * st.pageSize;
                const end = start + st.pageSize;
                const pageData = st.data.slice(start, end);
                
                console.log('[yoTable] refresh:', tableId, 'columns:', st.columns, 'pageData length:', pageData.length, 'first row:', pageData[0]);
                
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
                                // Regular cell - use columnKeys for data key mapping
                                const colIdx = st.columns.indexOf(col);
                                const dataKey = (st.columnKeys && st.columnKeys.length > colIdx && st.columnKeys[colIdx]) 
                                    ? st.columnKeys[colIdx] 
                                    : col;
                                const val = Array.isArray(row) ? row[colIdx] : (row[dataKey] ?? '');
                                return `<td>${val}</td>`;
                            }).join('');
                            return `<tr data-row-index="${globalIndex}">${cells}</tr>`;
                        }).join('');
                    }
                } else {
                    console.warn('[yoTable] tbody not found for table:', tableId);
                }
                
                // Hide loading, show table and pagination
                const loadingEl = document.getElementById(`${tableId}-loading`);
                if (loadingEl) loadingEl.style.display = 'none';
                const tableEl = el.querySelector('table');
                if (tableEl) tableEl.style.display = '';
                const paginationEl = el.querySelector('.comp-table-pagination');
                if (paginationEl) paginationEl.style.display = '';
            }
        };

        // Viewer Mode - Read Only
        const state = { config: [], brandTitle: 'yoAdmin', selectedMenuId: null, selectedSubmenuId: null, activeTabId: null };

        async function init() {
            const file = new URLSearchParams(location.search).get('config') || localStorage.getItem('yoAdminTargetFile') || 'admin_config.json';
            try {
                // Use encodeURIComponent to handle spaces/special characters
                const res = await fetch(`api.php?file=${encodeURIComponent(file)}`);
                if (res.ok) {
                    const data = await res.json();
                    // Support both old format (array) and new format (object with menus/brandTitle)
                    if (Array.isArray(data)) {
                        state.config = { menus: data };
                        state.brandTitle = 'yoAdmin';
                    } else {
                        state.config = data;
                        state.brandTitle = data.brandTitle || 'yoAdmin';
                    }
                }
            } catch (e) { console.error(e); }
            
            // Update brand title
            const brandEl = document.querySelector('.brand a');
            if (brandEl) brandEl.innerHTML = `<i class="fa-solid fa-shapes"></i> ${state.brandTitle}`;
            
            // Handle defaultOpen configuration
            if (state.config.defaultOpen) {
                const targetId = state.config.defaultOpen;
                const menus = state.config.menus || [];
                let found = false;
                
                for (const m of menus) {
                    if (m.id === targetId) {
                        state.selectedMenuId = m.id;
                        if (m.submenus && m.submenus.length > 0) {
                            state.selectedSubmenuId = m.submenus[0].id;
                        }
                        found = true;
                    } else if (m.submenus) {
                        const sub = m.submenus.find(s => s.id === targetId);
                        if (sub) {
                            state.selectedMenuId = m.id;
                            state.selectedSubmenuId = sub.id;
                            found = true;
                        }
                    }
                    
                    if (found) {
                        // We use the global getTabs, but we must ensure state is set first (which it is)
                        // However, getTabs() function is defined below. 
                        // Since function declarations are hoisted, this is fine.
                        const tabs = getTabs(); 
                        if (tabs && tabs.length > 0) {
                            state.activeTabId = tabs[0].id;
                        }
                        break;
                    }
                }
            }

            renderSidebar();
            renderGlobalAreas();
            
            // If default was selected, show workspace
            if (state.selectedMenuId) {
                showWorkspace();
            }
        }

        function renderSidebar() {
            const el = document.getElementById('menu-tree');
            el.innerHTML = (state.config.menus || []).map(m => {
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
                            <div class="submenu-list ${isExpanded ? 'open' : ''}">
                                <div class="submenu-inner">
                                    ${(m.submenus || []).map(s => `<div class="submenu-item ${state.selectedSubmenuId === s.id ? 'active' : ''}" data-menu="${m.id}" data-sub="${s.id}">${s.title}</div>`).join('')}
                                </div>
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
                    const menu = (state.config.menus || []).find(m => m.id === state.selectedMenuId);
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
                    // Check if currently open (by class)
                    const isOpen = submenuList?.classList.contains('open');
                    
                    // Accordion: collapse all other menus first
                    el.querySelectorAll('.menu-item').forEach(otherItem => {
                        if (otherItem !== menuItem) {
                            const otherList = otherItem.querySelector('.submenu-list');
                            const otherChevron = otherItem.querySelector('.menu-chevron');
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
                };
            });
        }

        function getSubmenu() {
            const m = (state.config.menus || []).find(x => x.id === state.selectedMenuId);
            if (!state.selectedSubmenuId) return null;
            return m?.submenus?.find(x => x.id === state.selectedSubmenuId);
        }
        
        function getTabs() {
            const menu = (state.config.menus || []).find(m => m.id === state.selectedMenuId);
            if (!state.selectedSubmenuId && menu?.tabs) return menu.tabs;
            const sub = getSubmenu();
            return sub?.tabs || [];
        }

        function showWorkspace() {
            document.getElementById('empty-state').classList.add('hidden');
            document.getElementById('workspace').classList.remove('hidden');
            const m = (state.config.menus || []).find(x => x.id === state.selectedMenuId);
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
                // For modal/loading/table, putting ID on wrapper causes collision with inner component ID.
                const hasInnerIdComponent = c.type === 'modal' || c.type === 'loading' || c.type === 'table';
                const customId = (c.customId && !hasInnerIdComponent) ? `id="${c.customId}"` : '';
                const customClass = c.customClass ? c.customClass : '';
                return `
                <div class="grid-item ${customClass}" data-id="${c.id}" ${customId} style="grid-column:${(c.x||0)+1}/span ${c.w||4};grid-row:${(c.y||0)+1}/span ${c.h||2}">
                    <div class="item-content">${getComponentContent(c)}</div>
                </div>
            `}).join('');
            
            // Load HTML files and execute scripts
            // Load HTML/Markdown files and execute scripts
            loadHtmlFiles(g);
            loadMarkdownFiles(g);
            executeScripts(g);
        }
        
        // Render global header/footer areas
        function renderGlobalAreas() {
            const headerContainer = document.getElementById('global-header');
            const footerContainer = document.getElementById('global-footer');
            
            const globalHeader = state.config.globalHeader;
            const globalFooter = state.config.globalFooter;
            
            // Render header
            if (globalHeader && globalHeader.components && globalHeader.components.length > 0) {
                headerContainer.innerHTML = globalHeader.components.map(c => {
                    const customId = c.customId ? `id="${c.customId}"` : '';
                    const customClass = c.customClass || '';
                    return `<div class="global-item ${customClass}" ${customId}>${getComponentContent(c)}</div>`;
                }).join('');
                headerContainer.classList.add('active');
                loadHtmlFiles(headerContainer);
                loadMarkdownFiles(headerContainer);
                executeScripts(headerContainer);
            } else {
                headerContainer.innerHTML = '';
                headerContainer.classList.remove('active');
            }
            
            // Render footer
            if (globalFooter && globalFooter.components && globalFooter.components.length > 0) {
                footerContainer.innerHTML = globalFooter.components.map(c => {
                    const customId = c.customId ? `id="${c.customId}"` : '';
                    const customClass = c.customClass || '';
                    return `<div class="global-item ${customClass}" ${customId}>${getComponentContent(c)}</div>`;
                }).join('');
                footerContainer.classList.add('active');
                loadHtmlFiles(footerContainer);
                loadMarkdownFiles(footerContainer);
                executeScripts(footerContainer);
            } else {
                footerContainer.innerHTML = '';
                footerContainer.classList.remove('active');
            }
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

        async function loadMarkdownFiles(container) {
            const fileElements = container.querySelectorAll('.comp-markdown-file[data-file]');
            for (const el of fileElements) {
                const filePath = el.dataset.file;
                try {
                    const res = await fetch(`api.php?action=readfile&path=${encodeURIComponent(filePath)}`);
                    if (res.ok) {
                        const content = await res.text();
                        if (typeof marked !== 'undefined') {
                            el.innerHTML = marked.parse(content);
                            // Add basic styles
                            el.style.padding = '1rem';
                            el.style.lineHeight = '1.6';
                        } else {
                            el.innerHTML = '<pre>' + content + '</pre>';
                        }
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
            console.log(`[Viewer] Found ${scripts.length} scripts to execute.`);
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                
                // Copy all attributes
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                
                if (oldScript.src) {
                    newScript.src = oldScript.src;
                } else {
                    newScript.textContent = oldScript.textContent;
                }
                
                console.log('[Viewer] Executing script:', oldScript.src || 'inline');
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
        }
        
        function getComponentContent(comp) {
            const label = comp.label || 'Label';
            const pos = comp.labelPosition || 'left';
            let flexClass = 'label-left';
            if (pos === 'right') flexClass = 'label-right';
            if (pos === 'top') flexClass = 'label-top';
            if (pos === 'bottom') flexClass = 'label-bottom';
            
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
                case 'select': {
                    const options = comp.options || ['Option 1', 'Option 2', 'Option 3'];
                    const defaultVal = comp.defaultValue || '';
                    const optionsHtml = options.map(o => `<option${o === defaultVal ? ' selected' : ''}>${o}</option>`).join('');
                    return pos === 'right'
                        ? `<label class="comp-select ${flexClass}"><select>${optionsHtml}</select><span>${label}</span></label>`
                        : `<label class="comp-select ${flexClass}"><span>${label}</span><select>${optionsHtml}</select></label>`;
                }
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
                    const mode = comp.checklistMode || 'single'; 
                    const inputType = mode === 'single' ? 'radio' : 'checkbox';
                    const nameAttr = mode === 'single' ? `name="chk-${comp.customId || Math.random().toString(36).substr(2, 9)}"` : ''; 
                    
                    let listHtml = items.map((item, idx) => `
                        <label class="checklist-item" style="display:flex;align-items:center;gap:6px;margin-bottom:4px;cursor:pointer;">
                            <input type="${inputType}" ${nameAttr} id="${comp.customId || 'chk'}-${idx}" style="margin:0;width:auto;cursor:pointer;" ${(mode === 'single' && idx === 0) ? 'checked' : ''}>
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
                    const columnKeys = comp.columnKeys || [];
                    const pageSize = comp.pageSize || 10;
                    const tableLabel = comp.label || '';
                    const headerRow = columns.map(c => `<th>${c}</th>`).join('');
                    
                    return `
                        <div id="${tableId}" class="comp-table" data-pagesize="${pageSize}" data-columns='${JSON.stringify(columns)}' data-column-keys='${JSON.stringify(columnKeys)}' data-label="${tableLabel}">
                            <div class="comp-loading-inline" id="${tableId}-loading">
                                <i class="fa-solid fa-spinner fa-spin"></i> Loading...
                            </div>
                            <table style="display:none;">
                                <thead><tr>${headerRow}</tr></thead>
                                <tbody></tbody>
                            </table>
                            <div class="comp-table-pagination" style="display:none;">
                                <button onclick="yoTable.prevPage('${tableId}')">&laquo; Prev</button>
                                <span class="page-info">Page 1</span>
                                <button onclick="yoTable.nextPage('${tableId}')">Next &raquo;</button>
                            </div>
                        </div>
                    `;
                }
                case 'chart':
                    return `
                        <div class="comp-chart-wrapper">
                            <div class="comp-chart-label" style="font-weight:600;font-size:0.9rem;color:var(--text);margin-bottom:8px;">${label}</div>
                            <div class="comp-chart-container">
                                <div class="comp-loading-inline" id="chart-${comp.id}-loading">
                                    <i class="fa-solid fa-spinner fa-spin"></i> Loading...
                                </div>
                                <canvas id="canvas-${comp.id}" class="comp-chart-canvas" style="display:none;"
                                    data-type="${comp.chartType || 'bar'}"
                                    data-target="${comp.targetTableId || ''}"
                                    data-col="${comp.dataColumn || ''}"
                                    data-label="${comp.labelColumn || ''}"></canvas>
                            </div>
                        </div>
                    `;
                case 'markdown':
                    if (comp.content) {
                        return `<div class="comp-markdown">${typeof marked !== 'undefined' ? marked.parse(comp.content) : comp.content}</div>`;
                    } else if (comp.filePath) {
                        return `<div class="comp-markdown comp-markdown-file" data-file="${comp.filePath}"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
                    } else {
                        return `<div class="comp-markdown"></div>`;
                    }
                default:
                    return `<span>${label}</span>`;
            }
        }

        // ==========================================
        // Chart Integration
        // ==========================================
        const yoCharts = {};

        function updateChart(tableId) {
            const charts = document.querySelectorAll(`.comp-chart-canvas[data-target="${tableId}"]`);
            if (charts.length === 0) return;
            
            // Get data from yoTable
            if (typeof yoTable === 'undefined') return;
            const data = yoTable.getData(tableId);
            const columns = yoTable._getState(tableId)?.columns || [];
            if (!data || data.length === 0) return;

            charts.forEach(canvas => {
                const type = canvas.dataset.type || 'bar';
                const valCol = canvas.dataset.col;
                const labelCol = canvas.dataset.label;
                
                // Extract values
                let values = [];
                let labels = [];
                
                // Determine column indices if using array-of-arrays
                // Also get columnKeys for data key mapping
                const columnKeys = yoTable._getState(tableId)?.columnKeys || [];
                
                // Map display column name to data key
                const valColIdx = columns.indexOf(valCol);
                const valDataKey = (columnKeys.length > valColIdx && columnKeys[valColIdx]) ? columnKeys[valColIdx] : valCol;
                
                const labelColIdx = columns.indexOf(labelCol);
                const labelDataKey = (columnKeys.length > labelColIdx && columnKeys[labelColIdx]) ? columnKeys[labelColIdx] : labelCol;
                
                data.forEach((row, i) => {
                    // Extract value
                    let v = null;
                    if (Array.isArray(row)) {
                        if (valColIdx >= 0) v = row[valColIdx];
                    } else {
                        v = row[valDataKey];
                    }
                    
                    // Extract label from specified column
                    let l = null;
                    if (labelCol && labelCol.trim() !== '') {
                        if (Array.isArray(row)) {
                            if (labelColIdx >= 0) l = row[labelColIdx];
                        } else {
                            l = row[labelDataKey];
                        }
                    }
                    // Fallback to row number if no label column or value is empty
                    if (l == null || l === '') {
                        l = `Row ${i + 1}`;
                    }
                    
                    if (v != null && v !== '' && !isNaN(v)) {
                        values.push(Number(v));
                        labels.push(String(l));
                    }
                });
                
                if (values.length === 0) return;

                // Prepare Chart Data
                let chartData, chartLabels;
                
                if (type === 'histogram') {
                     // Binning Logic
                     const min = Math.min(...values);
                     const max = Math.max(...values);
                     const binCount = Math.min(10, values.length); 
                     const range = max - min;
                     const step = range > 0 ? range / binCount : 1;
                     
                     const bins = new Array(binCount).fill(0);
                     const binLabels = [];
                     
                     for(let i=0; i<binCount; i++) {
                         const start = min + i*step;
                         const end = min + (i+1)*step;
                         binLabels.push(`${start.toFixed(1)} - ${end.toFixed(1)}`);
                     }
                     
                     values.forEach(v => {
                         let idx = Math.floor((v - min) / step);
                         if (idx >= binCount) idx = binCount - 1;
                         if (idx < 0) idx = 0;
                         bins[idx]++;
                     });
                     
                     chartData = bins;
                     chartLabels = binLabels;
                } else {
                     chartData = values;
                     chartLabels = labels;
                }

                // Color generation
                const bgColors = type === 'pie' 
                    ? chartData.map(() => `hsl(${Math.random()*360}, 70%, 60%)`) 
                    : 'rgba(54, 162, 235, 0.6)';
                
                const borderColors = type === 'pie'
                    ? 'white'
                    : 'rgba(54, 162, 235, 1)';

                // Destroy existing
                if (yoCharts[canvas.id]) {
                    yoCharts[canvas.id].destroy();
                }

                // Render Chart
                yoCharts[canvas.id] = new Chart(canvas, {
                    type: type === 'histogram' ? 'bar' : type,
                    data: {
                        labels: chartLabels,
                        datasets: [{
                            label: valCol || 'Frequency',
                            data: chartData,
                            backgroundColor: bgColors,
                            borderColor: borderColors,
                            borderWidth: 1,
                            barPercentage: type === 'histogram' ? 1.0 : 0.9,
                            categoryPercentage: type === 'histogram' ? 1.0 : 0.8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: type === 'pie' }
                        },
                        scales: type === 'pie' ? {} : {
                            y: { beginAtZero: true }
                        }
                    }
                });
                
                // Hide loading, show canvas
                const compId = canvas.id.replace('canvas-', '');
                const chartLoadingEl = document.getElementById(`chart-${compId}-loading`);
                if (chartLoadingEl) chartLoadingEl.style.display = 'none';
                canvas.style.display = '';
            });
        }

        // Hook into yoTable.refresh to auto-update charts
        if (typeof yoTable !== 'undefined') {
            const originalRefresh = yoTable.refresh;
            yoTable.refresh = function(tableId) {
                originalRefresh.call(yoTable, tableId);
                updateChart(tableId);
            };
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
    <!-- Global Loading Overlay -->
    <div id="global-loading" class="global-loading-overlay hidden">
        <div class="global-loading-spinner"></div>
        <div id="global-loading-text">Loading...</div>
    </div>

    <script>
        // Global Loading Utilities
        window.showLoading = function(text = 'Loading...') {
            const overlay = document.getElementById('global-loading');
            const textEl = document.getElementById('global-loading-text');
            if (overlay) {
                if (textEl) textEl.textContent = text;
                overlay.classList.remove('hidden');
            }
        };

        window.hideLoading = function() {
            const overlay = document.getElementById('global-loading');
            if (overlay) {
                overlay.classList.add('hidden');
            }
        };
    </script>

    <script src="../shared/theme.js"></script>
</body>
</html>
