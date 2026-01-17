<?php require_once 'auth.php'; ?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>yoAdmin Builder</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../shared/theme.css">
    <link rel="stylesheet" href="style.css">
    <!-- CodeMirror -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/theme/dracula.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/hint/show-hint.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/xml/xml.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/javascript/javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/css/css.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/htmlmixed/htmlmixed.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/hint/show-hint.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/hint/html-hint.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/hint/css-hint.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/hint/javascript-hint.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/closetag.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/closebrackets.min.js"></script>
</head>
<body>
    <div id="app">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="brand" id="brand-title" style="cursor:pointer;" title="Click to edit title">
                <i class="fa-solid fa-shapes"></i> <span id="brand-text">yoAdmin</span>
                <i class="fa-solid fa-pen" style="font-size:0.6rem;margin-left:5px;color:var(--text-muted);"></i>
            </div>
            <button id="add-menu-btn" class="btn-add"><i class="fa-solid fa-plus"></i> Add Menu</button>
            <div id="menu-tree" class="menu-tree"></div>
            <div class="sidebar-footer">
                <div class="file-controls">
                    <label>Config File:</label>
                    <input type="text" id="file-input" value="admin_config.json" placeholder="filename.json" readonly style="background-color:var(--bg-card);color:var(--text-muted);cursor:default;">
                    <button id="browse-btn" class="btn-sm" title="Browse Files"><i class="fa-solid fa-folder-open"></i> Open</button>
                </div>
                <div style="display:flex;gap:5px;">
                    <button id="save-btn" class="btn-primary" style="flex:1;"><i class="fa-solid fa-save"></i> Save</button>
                </div>
                <!-- Help Button -->
                <div style="margin-top: 10px; text-align: center;">
                    <button onclick="openHelp()" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:0.8rem;text-decoration:underline;">
                        <i class="fa-regular fa-circle-question"></i> Help / Guide
                    </button>
                </div>
            </div>
        </aside>

        <!-- Main -->
        <main class="main">
            <header class="header">
                <div id="breadcrumbs" class="breadcrumbs">Select a submenu</div>
                <div class="header-right">
                    <div class="tools-menu hidden" id="tools-menu">
                        <button class="header-tools-btn" id="header-tools-btn">
                            <i class="fa-solid fa-toolbox"></i> Tools
                            <i class="fa-solid fa-chevron-down" style="font-size:0.6rem;"></i>
                        </button>
                        <div class="tools-dropdown" id="tools-dropdown">
                            <div class="tool" data-type="html" draggable="true"><i class="fa-brands fa-html5"></i> HTML/JS</div>
                            <div class="tool" data-type="button" draggable="true"><i class="fa-solid fa-play"></i> Button</div>
                            <div class="tool" data-type="form" draggable="true"><i class="fa-solid fa-align-left"></i> Form</div>
                            <div class="tool" data-type="checkbox" draggable="true"><i class="fa-regular fa-square-check"></i> Checkbox</div>
                            <div class="tool" data-type="toggle" draggable="true"><i class="fa-solid fa-toggle-on"></i> Toggle</div>
                            <div class="tool" data-type="checklist" draggable="true"><i class="fa-solid fa-list-check"></i> Checklist</div>
                            <div class="tool" data-type="input" draggable="true"><i class="fa-solid fa-keyboard"></i> Input</div>
                            <div class="tool" data-type="datepicker" draggable="true"><i class="fa-solid fa-calendar"></i> Calendar</div>
                            <div class="tool" data-type="modal" draggable="true"><i class="fa-regular fa-window-restore"></i> Modal</div>
                            <div class="tool" data-type="table" draggable="true"><i class="fa-solid fa-table"></i> Table</div>
                        </div>
                    </div>
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
                </div>
            </header>

            <!-- Empty State -->
            <div id="empty-state" class="empty-state">
                <p>Select or create a submenu to start editing.</p>
            </div>

            <!-- Workspace -->
            <div id="workspace" class="workspace hidden">
                <div class="tabs-bar">
                    <div id="tabs" class="tabs"></div>
                </div>
                <div id="grid-container" class="grid-container">
                    <div id="grid" class="grid"></div>
                </div>
            </div>
        </main>
    </div>

    <!-- Help Modal -->
    <div id="help-modal" class="comp-modal-overlay">
        <div class="comp-modal-content" style="max-width:800px;width:90%;">
            <button class="comp-modal-close" onclick="document.getElementById('help-modal').style.display='none'">&times;</button>
            <div id="help-content" style="max-height:80vh;overflow-y:auto;line-height:1.6;">Loading guide...</div>
        </div>
    </div>

    <!-- Global Loading Overlay -->
    <div id="global-loading" class="global-loading-overlay hidden">
        <div class="global-loading-spinner"></div>
        <div id="global-loading-text">Loading...</div>
    </div>

    <!-- Marked.js -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

    <div id="modal" class="modal hidden">
        <div class="modal-content">
            <header><span id="modal-title">Title</span><button id="modal-close">&times;</button></header>
            <div id="modal-body"></div>
            <footer>
                <button id="modal-cancel">Cancel</button>
                <button id="modal-confirm" class="btn-primary">OK</button>
            </footer>
        </div>
    </div>

    <!-- Browser Modal (Stacked) -->
    <div id="browser-modal" class="modal hidden" style="z-index:10001;">
        <div class="modal-content" style="max-width:600px;">
            <header>
                <span id="browser-modal-title">Browse Files</span>
                <button id="browser-modal-close">&times;</button>
            </header>
            <div id="browser-modal-body"></div>
        </div>
    </div>

    <script>window.currentUser = "<?= isset($_SESSION['user']) ? htmlspecialchars($_SESSION['user']) : '' ?>";</script>
    <script>
        async function openHelp() {
            document.getElementById('help-modal').style.display = 'flex';
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
    <script src="app.js"></script>
</body>
</html>
