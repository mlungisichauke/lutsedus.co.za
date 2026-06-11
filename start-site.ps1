param(
    [int]$Port = 8080,
    [string]$HostAddress = "0.0.0.0"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

function Get-PhpPath {
    $phpCommand = Get-Command php -ErrorAction SilentlyContinue
    if ($phpCommand) {
        return $phpCommand.Source
    }

    $candidates = @(
        "C:\\xampp\\php\\php.exe",
        "C:\\wamp64\\bin\\php\\php8.3.6\\php.exe",
        "C:\\wamp64\\bin\\php\\php8.2.0\\php.exe",
        "C:\\Program Files\\PHP\\php.exe"
    )

    foreach ($path in $candidates) {
        if (Test-Path $path) {
            return $path
        }
    }

    $wampPhp = Get-ChildItem "C:\\wamp64\\bin\\php" -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        Select-Object -First 1

    if ($wampPhp) {
        $exe = Join-Path $wampPhp.FullName "php.exe"
        if (Test-Path $exe) {
            return $exe
        }
    }

    return $null
}

$phpPath = Get-PhpPath

if ($phpPath) {
    Write-Host "Starting with PHP: $phpPath" -ForegroundColor Green
    Write-Host "URL: http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "LAN URL: http://<your-laptop-ip>:$Port" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow
    & $phpPath -S "${HostAddress}:$Port" -t $projectRoot
    exit $LASTEXITCODE
}

$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    Write-Warning "PHP was not found. Starting static fallback with Python."
    Write-Warning "Admin features in admin-api.php will not work until PHP is installed."
    Write-Warning "To fully host the site on your laptop, install PHP or XAMPP first."
    Write-Host "URL: http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "LAN URL: http://<your-laptop-ip>:$Port" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow
    & python -m http.server $Port --bind $HostAddress --directory $projectRoot
    exit $LASTEXITCODE
}

Write-Error "Neither PHP nor Python was found. Install PHP (recommended) or Python, then run this script again."
