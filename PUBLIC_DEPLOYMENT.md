# Public Deployment Guide (lutsedus.co.za)

This project is ready for public hosting on any PHP-capable web host (cPanel, Plesk, or managed hosting).

## 1) Upload files to your web root

Upload all project files and folders to your domain web root:

- `public_html/` (cPanel), or
- `httpdocs/` (Plesk)

Required top-level files include:

- `index.html`
- `style.css`
- `script.js`
- `cms-runtime.js`
- `admin.html`
- `admin.js`
- `admin.css`
- `admin-api.php`
- `.htaccess`
- `robots.txt`
- `sitemap.xml`

Required folders include:

- `images/`
- `uploads/`
- `data/`

## 2) Set file permissions

Set permissions so the site is public but writable only where needed:

- directories: `755` (or `775` if your host requires it)
- normal files: `644`
- `data/admin-config.json`: `600` or `640` if supported
- `data/overrides.json`: `644` (or `664` if required)
- `uploads/`: `755` (or `775` if required)

## 3) Change admin password immediately

Default credentials must not be used in production.

- Open `https://lutsedus.co.za/admin.html`
- Login with current credentials
- Use **Change Admin Password**

## 4) Lock down admin endpoints (recommended)

In `admin-api.php`, configure `ALLOWED_ADMIN_IPS` with your office/home IP if possible.

Example:

```php
const ALLOWED_ADMIN_IPS = ['203.0.113.10', '198.51.100.0/24'];
```

You can also enable the optional admin restriction block in `.htaccess`.

## 5) Enable SSL/HTTPS

In hosting control panel:

- enable AutoSSL/Let's Encrypt for `lutsedus.co.za` and `www.lutsedus.co.za`
- force HTTPS redirect

## 6) Verify public launch

Check these URLs after upload:

- `https://lutsedus.co.za/`
- `https://lutsedus.co.za/privacy.html`
- `https://lutsedus.co.za/terms.html`
- `https://lutsedus.co.za/cookie.html`
- `https://lutsedus.co.za/robots.txt`
- `https://lutsedus.co.za/sitemap.xml`

Then validate admin:

- `https://lutsedus.co.za/admin.html`
- confirm login/logout works
- confirm Save Change writes to `data/overrides.json`

## 7) Submit site to search engines

- Add the domain to Google Search Console
- Submit `https://lutsedus.co.za/sitemap.xml`

## 8) Optional extra hardening

- rename admin entry page from `admin.html` to a private URL and update links
- remove or rotate any default credentials stored in local files
- back up `data/overrides.json`, `data/admin-config.json`, and `data/audit.log` regularly
