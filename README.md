# yoAdminBuilder

A management screen construction tool set.

## Components

1. **Builder (`index.html`)**: The editor where you design the admin layout.
2. **Viewer (`viewer.html`)**: The runtime interface that renders the configuration.
3. **API (`api.php`)**: Handles saving/loading JSON configurations.

## Setup & Usage

1. Start PHP Server:
   ```bash
   cd /mnt/c/Projects/mngtools/yoAdminBuilder
   php -S localhost:8000
   ```

2. **Open Builder**: [http://localhost:8000/index.html](http://localhost:8000/index.html)
   - Use the "Settings" button in the top right to specify which JSON file to save to (e.g., `my-admin.json`).
   - Defaults to `admin_config.json`.

3. **Open Viewer**: [http://localhost:8000/viewer.html](http://localhost:8000/viewer.html)
   - The viewer will try to load the file specified in your previous Builder session (via LocalStorage) or default to `admin_config.json`.
   - You can explicitly specify the config file via URL: `viewer.html?config=my-admin.json`.

## Separation of Concerns
- The **JSON Configuration** holds purely data about menus and layouts.
- The **Rendering Logic** (`render.js`) is shared but can be used independently by any wrapper.
- The **Viewer** is a lightweight wrapper that only displays the UI, suitable for end-users.