# Lutsedus Admin Portal Setup

## What this does

The admin portal now supports two modes:

1. Server mode (recommended):
- Uses `admin-api.php` + `data/overrides.json`
- Saves text/photo changes for all visitors

2. Local fallback mode:
- Uses browser localStorage only when PHP API is unavailable

## Files

- `admin.html`
- `admin.css`
- `admin.js`
- `admin-api.php`
- `cms-runtime.js`
- `data/overrides.json`
- `data/audit.log`
- `data/admin-config.json`
- `uploads/`
- `.htaccess`
- `uploads/.htaccess`

## Default admin credentials

- Username: `admin`
- Password: `Lutsedus@2026!`

## Change the admin password

Preferred method:
- Login to `admin.html`
- Use **Change Admin Password** inside the console

Alternative manual method:
- Update `passwordHash` in `data/admin-config.json`

1. Generate new SHA-256 hash (PowerShell):

```powershell
$text = 'YourNewStrongPassword';
$bytes = [System.Text.Encoding]::UTF8.GetBytes($text);
$sha = [System.Security.Cryptography.SHA256]::Create();
$hash = $sha.ComputeHash($bytes);
($hash | ForEach-Object { $_.ToString('x2') }) -join ''
```

2. Replace `passwordHash` value in `data/admin-config.json`.
3. Save and upload file.

## Optional IP allowlist

In `admin-api.php`, set `ALLOWED_ADMIN_IPS` to restrict admin access by IP.

Example:

```php
const ALLOWED_ADMIN_IPS = ['203.0.113.10', '198.51.100.0/24'];
```

Leave it as `[]` to allow any IP.

## cPanel permissions

Ensure the `data` folder is writable by PHP.

Typical safe permissions:
- `data` directory: `755` (or `775` if needed by host)
- `data/overrides.json`: `644` (or `664` if needed by host)
- `data/admin-config.json`: `600` or `640` if host supports it (otherwise `644`)
- `uploads` directory: `755` (or `775` if needed by host)

## Security notes

- Keep `admin.html` and `admin-api.php` private from public sharing.
- Use HTTPS on production.
- Change default password immediately.
- `.htaccess` now includes baseline hardening and optional admin IP restrictions.
- `uploads/.htaccess` prevents script execution in uploads.
- `data/audit.log` stores admin activity (login, edits, uploads, resets).
- Authenticated write actions use CSRF token validation.

## How editors use it

1. Go to `admin.html`.
2. Login.
3. Pick page (Home/Privacy/Terms/Cookie).
4. Click element in preview.
5. For photos, select a file from **Image From Folder (images/)**.
6. Click Apply Preview.
7. Click **Save Change**.

Image override values are restricted to existing files inside `images/`.

Saved changes are applied automatically by `cms-runtime.js` on site pages.
