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
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="brand"><i class="fa-solid fa-shapes"></i> yoAdmin</div>
            <button id="add-menu-btn" class="btn-add"><i class="fa-solid fa-plus"></i> Add Menu</button>
            <div id="menu-tree" class="menu-tree"></div>
            <div class="sidebar-footer">
                <div class="file-controls">
                    <label>Config File:</label>
                    <input type="text" id="file-input" value="admin_config.json" placeholder="filename.json">
                    <button id="load-btn" class="btn-sm">Load</button>
                </div>
                <button id="save-btn" class="btn-primary"><i class="fa-solid fa-save"></i> Save</button>
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

    <script src="app.js"></script>
</body>
</html>
