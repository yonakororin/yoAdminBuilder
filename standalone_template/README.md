# Standalone Viewer Template

This folder contains a standalone version of the yoAdmin viewer that can be deployed anywhere on your server.

## Usage

1. **Copy** this entire folder to your desired location (e.g., `/var/www/html/my-admin-panel/`).
2. **Rename** the folder if you wish.
3. **Export** your JSON configuration from `yoAdminBuilder` and save it as `admin_config.json` inside this folder.
   
   *Alternatively, update `index.php` logic or name your file `admin_config.json`.*

4. **Verify SSO Path**: 
   Open `index.php` and check the `$sso_relative_path` variable at the top (Line 10).
   Ensure it points correctly to the `yoSSO` directory relative to where you placed this folder.
   
   Example:
   If your structure is:
   ```
   /var/www/html/
      ├── mngtools/
      │     └── yoSSO/
      └── my_new_admin/   <-- You are here
   ```
   Then set `$sso_relative_path = '../mngtools/yoSSO';`

## Files

- `index.php`: The all-in-one viewer script (contains authentication, styles, and rendering logic).
- `admin_config.json`: The data file loaded by default.
