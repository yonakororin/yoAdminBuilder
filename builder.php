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
            <div class="brand">
                <a href="index.php" style="color:inherit;text-decoration:none;"><i class="fa-solid fa-shapes"></i> yoAdmin</a>
            </div>
            <button id="add-menu-btn" class="btn-add"><i class="fa-solid fa-plus"></i> Add Menu</button>
            <div id="menu-tree" class="menu-tree"></div>
            <div class="sidebar-footer">
                <div class="theme-selector" style="margin-bottom:0.5rem;">
                    <label style="font-size:0.75rem;color:var(--text-muted);margin-right:0.5rem;">Theme:</label>
                    <select title="Theme">
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
                <div class="file-controls">
                    <label>Config File:</label>
                    <input type="text" id="file-input" value="admin_config.json" placeholder="filename.json">
                    <button id="load-btn" class="btn-sm">Load</button>
                </div>
                <button id="save-btn" class="btn-primary"><i class="fa-solid fa-save"></i> Save</button>
                <div style="margin-top: 10px; text-align: center; border-top: 1px solid var(--border); padding-top: 10px;">
                    <a href="logout.php" style="color: var(--text-muted); font-size: 0.8rem; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <i class="fa-solid fa-sign-out-alt"></i> Logout
                    </a>
                </div>
            </div>
        </aside>

        <!-- Main -->
        <main class="main">
            <header class="header">
                <div id="breadcrumbs" class="breadcrumbs">Select a submenu</div>
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

            <!-- Toolbox -->
            <div id="toolbox" class="toolbox hidden collapsed">
                <div class="toolbox-header" id="toolbox-toggle">
                    <span><i class="fa-solid fa-toolbox"></i> Tools</span>
                    <i class="fa-solid fa-chevron-down caret"></i>
                </div>
                <div class="toolbox-content">
                    <div class="tool" data-type="html" draggable="true"><i class="fa-brands fa-html5"></i> HTML/JS</div>
                    <div class="tool" data-type="button" draggable="true"><i class="fa-solid fa-play"></i> Button</div>
                    <div class="tool" data-type="form" draggable="true"><i class="fa-solid fa-align-left"></i> Form</div>
                    <div class="tool" data-type="checkbox" draggable="true"><i class="fa-regular fa-square-check"></i> Checkbox</div>
                    <div class="tool" data-type="toggle" draggable="true"><i class="fa-solid fa-toggle-on"></i> Toggle</div>
                    <div class="tool" data-type="input" draggable="true"><i class="fa-solid fa-keyboard"></i> Input</div>
                    <div class="tool" data-type="datepicker" draggable="true"><i class="fa-solid fa-calendar"></i> Calendar</div>
                </div>
            </div>
        </main>
    </div>

    <!-- Modal -->
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

    <script>window.currentUser = "<?= isset($_SESSION['user']) ? htmlspecialchars($_SESSION['user']) : '' ?>";</script>
    <script src="../shared/theme.js"></script>
    <script src="app.js"></script>
</body>
</html>
