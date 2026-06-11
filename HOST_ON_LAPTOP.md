# Host This Site On Your Laptop (Windows)

This setup lets your laptop serve the website directly.

## Quick start

Run this from PowerShell inside the project folder:

```powershell
.\start-site.ps1
```

Default URL:

- http://localhost:8080

If you want another port:

```powershell
.\start-site.ps1 -Port 9090
```

## What the script does

- Uses PHP built-in server when PHP is available (recommended for this project).
- Falls back to Python static server when PHP is not available.

Important:

- This project contains `admin-api.php`.
- If fallback Python mode is used, admin save/login API features will not work.

## Install PHP on Windows (if not installed)

Use one of these options:

1. Install XAMPP, then run `.\start-site.ps1` again.
2. Install standalone PHP and add it to PATH, then run `.\start-site.ps1` again.

After install, verify:

```powershell
php -v
```

## Make it reachable on your local Wi-Fi (phone/other PCs)

1. Start the server:

```powershell
.\start-site.ps1
```

2. Get laptop IP:

```powershell
ipconfig
```

3. Open from another device:

- http://YOUR_LAPTOP_IP:8080

4. If blocked, allow firewall for the port:

```powershell
New-NetFirewallRule -DisplayName "Lutsedus Site 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

## Make it public on the internet from your laptop

### Fastest working method right now (Cloudflare Quick Tunnel)

1. Start the local site server:

```powershell
.\start-site.ps1
```

2. In another PowerShell window, run:

```powershell
& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url http://localhost:8080
```

3. Share the generated `https://...trycloudflare.com` URL with visitors.

Keep both windows open while the website is live.

### Option A: Router port forwarding (direct)

1. Forward external TCP port 8080 to your laptop local IP port 8080.
2. Keep laptop on and server running.
3. Use your public IP URL:

- http://YOUR_PUBLIC_IP:8080

Notes:

- Public IP may change unless you have static IP or dynamic DNS.
- Exposing a home laptop directly is less secure.

### Option B: Cloudflare Tunnel (safer and easier)

1. Install `cloudflared`.
2. Start local server:

```powershell
.\start-site.ps1
```

3. In another terminal, run:

```powershell
cloudflared tunnel --url http://localhost:8080
```

4. Use generated HTTPS public URL.

## Recommended for this project

- Use PHP mode (not Python fallback).
- Change admin password immediately in `admin.html`.
- Keep admin URL private.
