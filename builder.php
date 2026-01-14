<?php require_once 'auth.php'; ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>yoAdminBuilder</title>
    <link rel="stylesheet" href="style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
</head>
<body>
    <div id="app">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="brand">
                <h1>yoAdmin<span>Builder</span></h1>
            </div>
            
            <div class="menu-list" id="menu-list">
                <!-- Dynamic Menus -->
            </div>

            <button id="add-menu-btn" class="btn-primary full-width">+ Add Menu</button>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
            <header class="top-bar">
                <div id="breadcrumbs" class="breadcrumbs">Select a menu...</div>
                <div class="actions">
                    <button id="save-config-btn" class="btn-secondary">Save Config</button>
                    <button id="preview-btn" class="btn-secondary">Preview</button>
                </div>
            </header>

            <div id="workspace" class="workspace hidden">
                <!-- Tabs -->
                <div class="tabs-container">
                    <div class="tabs-header" id="tabs-header">
                        <!-- Dynamic Tabs -->
                    </div>
                    <button id="add-tab-btn" class="icon-btn" title="Add Tab">+</button>
                </div>

                <!-- Tab Content (Canvas) -->
                <div class="tab-content" id="active-tab-content">
                    <!-- Components render here -->
                </div>
                
                <!-- Toolbox for the active tab -->
                <div class="toolbox">
                    <h3>Toolbox</h3>
                    <div class="tools-grid">
                        <button class="tool-btn" data-type="input">Input Field</button>
                        <button class="tool-btn" data-type="button">Button</button>
                        <button class="tool-btn" data-type="html">Custom HTML/JS</button>
                    </div>
                </div>
            </div>
            
            <div id="empty-state" class="empty-state">
                <p>Select or create a menu item to start building.</p>
            </div>
        </main>
    </div>

    <!-- Modals hidden by default -->
    <div id="modal-overlay" class="modal-overlay hidden">
        <div class="modal">
            <h2 id="modal-title">Config</h2>
            <div id="modal-content"></div>
            <div class="modal-footer">
                <button id="modal-cancel" class="btn-text">Cancel</button>
                <button id="modal-confirm" class="btn-primary">Confirm</button>
            </div>
        </div>
    </div>

    <script type="module" src="app.js"></script>
</body>
</html>
