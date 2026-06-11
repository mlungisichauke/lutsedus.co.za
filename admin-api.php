<?php

declare(strict_types=1);

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASSWORD_HASH = '0f97dc9b8d3947ded6467cd5de0f5990c01078378c1a14d414cd64c11e8fca53'; // sha256("Lutsedus@2026!")
const ADMIN_CONFIG_FILE = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'admin-config.json';
const AUTH_VERSION_FILE = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'auth-version.txt';
const OVERRIDES_FILE = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'overrides.json';
const AUDIT_LOG_FILE = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'audit.log';
const UPLOAD_DIR = __DIR__ . DIRECTORY_SEPARATOR . 'uploads';
const IMAGES_DIR = __DIR__ . DIRECTORY_SEPARATOR . 'images';
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_SECONDS = 300;
const ALLOWED_ADMIN_IPS = []; // Example: ['203.0.113.10', '198.51.100.0/24']

$uploadMimeToExtension = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
    'image/svg+xml' => 'svg',
];

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function requirePost(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        respond(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [];
    }

    return $decoded;
}

function readOverrides(): array
{
    $path = OVERRIDES_FILE;

    if (!is_file($path)) {
        if (!is_dir(dirname($path))) {
            @mkdir(dirname($path), 0775, true);
        }
        file_put_contents($path, "[]\n", LOCK_EX);
    }

    $raw = file_get_contents($path);
    if ($raw === false) {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function readAdminConfig(): array
{
    $path = ADMIN_CONFIG_FILE;
    $defaults = [
        'username' => DEFAULT_ADMIN_USER,
        'passwordHash' => DEFAULT_ADMIN_PASSWORD_HASH,
    ];

    if (!is_file($path)) {
        if (!is_dir(dirname($path))) {
            @mkdir(dirname($path), 0775, true);
        }
        file_put_contents($path, json_encode($defaults, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n", LOCK_EX);
        return $defaults;
    }

    $raw = file_get_contents($path);
    if ($raw === false) {
        return $defaults;
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return $defaults;
    }

    $username = trim((string)($decoded['username'] ?? ''));
    $passwordHash = trim((string)($decoded['passwordHash'] ?? ''));

    if ($username === '' || strlen($passwordHash) !== 64) {
        return $defaults;
    }

    return [
        'username' => $username,
        'passwordHash' => $passwordHash,
    ];
}

function saveAdminConfig(array $config): bool
{
    $normalized = [
        'username' => trim((string)($config['username'] ?? DEFAULT_ADMIN_USER)),
        'passwordHash' => trim((string)($config['passwordHash'] ?? '')),
    ];

    if ($normalized['username'] === '' || strlen($normalized['passwordHash']) !== 64) {
        return false;
    }

    $json = json_encode($normalized, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }

    return file_put_contents(ADMIN_CONFIG_FILE, $json . "\n", LOCK_EX) !== false;
}

function readAuthVersion(): string
{
    $path = AUTH_VERSION_FILE;

    if (!is_file($path)) {
        if (!is_dir(dirname($path))) {
            @mkdir(dirname($path), 0775, true);
        }
        $seed = (string)time();
        file_put_contents($path, $seed . "\n", LOCK_EX);
        return $seed;
    }

    $raw = file_get_contents($path);
    $version = trim((string)$raw);
    if ($version === '') {
        $version = (string)time();
        file_put_contents($path, $version . "\n", LOCK_EX);
    }

    return $version;
}

function bumpAuthVersion(): string
{
    $version = (string)(time() . '-' . bin2hex(random_bytes(4)));
    file_put_contents(AUTH_VERSION_FILE, $version . "\n", LOCK_EX);
    return $version;
}

function saveOverrides(array $rows): bool
{
    $json = json_encode(array_values($rows), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }

    return file_put_contents(OVERRIDES_FILE, $json . "\n", LOCK_EX) !== false;
}

function isAuthed(): bool
{
    if (empty($_SESSION['lutsedus_admin_auth']) || $_SESSION['lutsedus_admin_auth'] !== true) {
        return false;
    }

    $sessionVersion = (string)($_SESSION['lutsedus_auth_version'] ?? '');
    if ($sessionVersion === '') {
        return false;
    }

    return hash_equals(readAuthVersion(), $sessionVersion);
}

function requireAuth(): void
{
    if (!isAuthed()) {
        unset($_SESSION['lutsedus_admin_auth'], $_SESSION['lutsedus_auth_version'], $_SESSION['lutsedus_csrf_token']);
        respond(401, ['ok' => false, 'message' => 'Unauthorized.']);
    }
}

function getClientIp(): string
{
    $forwarded = (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');
    if ($forwarded !== '') {
        $parts = explode(',', $forwarded);
        $candidate = trim((string)($parts[0] ?? ''));
        if ($candidate !== '') {
            return $candidate;
        }
    }

    return (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function ipInCidr(string $ip, string $cidr): bool
{
    $cidrParts = explode('/', $cidr, 2);
    if (count($cidrParts) !== 2) {
        return false;
    }

    [$subnet, $maskBitsRaw] = $cidrParts;
    $maskBits = (int)$maskBitsRaw;

    $ipLong = ip2long($ip);
    $subnetLong = ip2long($subnet);
    if ($ipLong === false || $subnetLong === false || $maskBits < 0 || $maskBits > 32) {
        return false;
    }

    if ($maskBits === 0) {
        return true;
    }

    $mask = -1 << (32 - $maskBits);
    return (($ipLong & $mask) === ($subnetLong & $mask));
}

function ipAllowed(string $ip): bool
{
    if (count(ALLOWED_ADMIN_IPS) === 0) {
        return true;
    }

    foreach (ALLOWED_ADMIN_IPS as $rule) {
        $rule = trim((string)$rule);
        if ($rule === '') {
            continue;
        }

        if (strpos($rule, '/') !== false) {
            if (ipInCidr($ip, $rule)) {
                return true;
            }
            continue;
        }

        if ($ip === $rule) {
            return true;
        }
    }

    return false;
}

function requireAllowedIp(): void
{
    $ip = getClientIp();
    if (!ipAllowed($ip)) {
        respond(403, ['ok' => false, 'message' => 'Admin access from this IP is not allowed.']);
    }
}

function auditEvent(string $event, array $meta = []): void
{
    $base = [
        'time' => gmdate('c'),
        'event' => $event,
        'ip' => getClientIp(),
        'authenticated' => isAuthed(),
    ];

    $entry = array_merge($base, $meta);
    $line = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($line === false) {
        return;
    }

    $dir = dirname(AUDIT_LOG_FILE);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    @file_put_contents(AUDIT_LOG_FILE, $line . "\n", FILE_APPEND | LOCK_EX);
}

function tailAudit(int $limit = 100): array
{
    if (!is_file(AUDIT_LOG_FILE)) {
        return [];
    }

    $lines = @file(AUDIT_LOG_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return [];
    }

    $slice = array_slice($lines, -1 * max(1, min(200, $limit)));
    $events = [];
    foreach ($slice as $line) {
        $decoded = json_decode($line, true);
        if (is_array($decoded)) {
            $events[] = $decoded;
        }
    }

    return $events;
}

function getLoginState(): array
{
    $state = $_SESSION['lutsedus_login_state'] ?? [];
    if (!is_array($state)) {
        return ['count' => 0, 'lockUntil' => 0];
    }

    return [
        'count' => (int)($state['count'] ?? 0),
        'lockUntil' => (int)($state['lockUntil'] ?? 0),
    ];
}

function setLoginState(array $state): void
{
    $_SESSION['lutsedus_login_state'] = [
        'count' => (int)($state['count'] ?? 0),
        'lockUntil' => (int)($state['lockUntil'] ?? 0),
    ];
}

function ensureLoginNotLocked(): void
{
    $state = getLoginState();
    $now = time();

    if ($state['lockUntil'] > $now) {
        $remaining = max(1, $state['lockUntil'] - $now);
        respond(429, ['ok' => false, 'message' => 'Too many failed attempts. Retry in ' . $remaining . ' seconds.']);
    }
}

function registerLoginFailure(): void
{
    $state = getLoginState();
    $state['count']++;
    if ($state['count'] >= MAX_LOGIN_ATTEMPTS) {
        $state['count'] = 0;
        $state['lockUntil'] = time() + LOGIN_LOCK_SECONDS;
    }
    setLoginState($state);
}

function clearLoginFailures(): void
{
    setLoginState(['count' => 0, 'lockUntil' => 0]);
}

function ensureCsrfToken(): string
{
    $token = (string)($_SESSION['lutsedus_csrf_token'] ?? '');
    if ($token === '') {
        $token = bin2hex(random_bytes(32));
        $_SESSION['lutsedus_csrf_token'] = $token;
    }

    return $token;
}

function requireCsrfToken(): void
{
    $expected = ensureCsrfToken();
    $provided = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($provided === '' || !hash_equals($expected, $provided)) {
        respond(403, ['ok' => false, 'message' => 'Invalid CSRF token.']);
    }
}

function isAllowedImagePath(string $value): bool
{
    $value = trim($value);
    if ($value === '' || !preg_match('/^images\/[A-Za-z0-9._\/-]+$/', $value)) {
        return false;
    }

    if (strpos($value, '..') !== false) {
        return false;
    }

    if (!preg_match('/\.(jpg|jpeg|png|webp|gif|svg)$/i', $value)) {
        return false;
    }

    $relative = substr($value, strlen('images/'));
    $candidate = IMAGES_DIR . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative);

    $baseReal = realpath(IMAGES_DIR);
    $fileReal = realpath($candidate);
    if ($baseReal === false || $fileReal === false) {
        return false;
    }

    if (strpos($fileReal, $baseReal) !== 0) {
        return false;
    }

    return is_file($fileReal);
}

function listImagesFromFolder(): array
{
    if (!is_dir(IMAGES_DIR)) {
        return [];
    }

    $paths = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(IMAGES_DIR, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if (!$file->isFile()) {
            continue;
        }

        $filename = $file->getFilename();
        if (!preg_match('/\.(jpg|jpeg|png|webp|gif|svg)$/i', $filename)) {
            continue;
        }

        $fullPath = $file->getPathname();
        $relative = substr($fullPath, strlen(IMAGES_DIR) + 1);
        if ($relative === false) {
            continue;
        }

        $paths[] = 'images/' . str_replace(DIRECTORY_SEPARATOR, '/', $relative);
    }

    sort($paths, SORT_NATURAL | SORT_FLAG_CASE);
    return $paths;
}

function sanitizeOverride(array $item): ?array
{
    $page = trim((string)($item['page'] ?? ''));
    $selector = trim((string)($item['selector'] ?? ''));
    $type = trim((string)($item['type'] ?? ''));
    $value = (string)($item['value'] ?? '');

    $allowedPages = ['index.html', 'privacy.html', 'terms.html', 'cookie.html'];
    $allowedTypes = ['text', 'html', 'image-src', 'background-image'];

    if (!in_array($page, $allowedPages, true)) {
        return null;
    }

    if (!in_array($type, $allowedTypes, true)) {
        return null;
    }

    if ($selector === '' || strlen($selector) > 600) {
        return null;
    }

    if (strlen($value) > 40000) {
        return null;
    }

    if (($type === 'image-src' || $type === 'background-image') && !isAllowedImagePath($value)) {
        return null;
    }

    return [
        'id' => $page . '|' . $selector . '|' . $type,
        'page' => $page,
        'selector' => $selector,
        'type' => $type,
        'value' => $value,
    ];
}

$action = strtolower((string)($_GET['action'] ?? 'health'));

if ($action === 'health') {
    $authed = isAuthed();
    $payload = ['ok' => true, 'backend' => 'php-json-cms', 'authenticated' => $authed];
    if ($authed) {
        $payload['csrfToken'] = ensureCsrfToken();
    }
    respond(200, $payload);
}

if ($action === 'public_overrides') {
    $rows = readOverrides();
    respond(200, ['ok' => true, 'items' => $rows]);
}

if ($action === 'session') {
    $authed = isAuthed();
    $payload = ['ok' => true, 'authenticated' => $authed];
    if ($authed) {
        $payload['csrfToken'] = ensureCsrfToken();
    }
    respond(200, $payload);
}

if ($action === 'login') {
    requirePost();
    requireAllowedIp();
    ensureLoginNotLocked();
    $body = readJsonBody();

    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');
    $adminConfig = readAdminConfig();

    $passwordHash = hash('sha256', $password);
    if ($username === (string)$adminConfig['username'] && hash_equals((string)$adminConfig['passwordHash'], $passwordHash)) {
        session_regenerate_id(true);
        $_SESSION['lutsedus_admin_auth'] = true;
        $_SESSION['lutsedus_auth_version'] = readAuthVersion();
        clearLoginFailures();
        $csrfToken = ensureCsrfToken();
        auditEvent('admin_login_success', ['username' => $username]);
        respond(200, ['ok' => true, 'authenticated' => true, 'csrfToken' => $csrfToken]);
    }

    registerLoginFailure();
    auditEvent('admin_login_failed', ['username' => $username]);

    respond(401, ['ok' => false, 'message' => 'Invalid credentials.']);
}

if ($action === 'logout') {
    requirePost();
    requireAllowedIp();
    requireCsrfToken();
    auditEvent('admin_logout');
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    respond(200, ['ok' => true]);
}

if ($action === 'get_overrides') {
    requireAuth();
    requireAllowedIp();
    $rows = readOverrides();
    respond(200, ['ok' => true, 'items' => $rows]);
}

if ($action === 'get_audit') {
    requireAuth();
    requireAllowedIp();
    respond(200, ['ok' => true, 'items' => tailAudit(120)]);
}

if ($action === 'list_images') {
    requireAuth();
    requireAllowedIp();
    respond(200, ['ok' => true, 'items' => listImagesFromFolder()]);
}

if ($action === 'save_override') {
    requireAuth();
    requireAllowedIp();
    requirePost();
    requireCsrfToken();
    $body = readJsonBody();

    $normalized = sanitizeOverride($body);
    if ($normalized === null) {
        respond(422, ['ok' => false, 'message' => 'Invalid override payload.']);
    }

    $rows = readOverrides();
    $found = false;

    foreach ($rows as $idx => $row) {
        if (($row['id'] ?? '') === $normalized['id']) {
            $rows[$idx] = $normalized;
            $found = true;
            break;
        }
    }

    if (!$found) {
        $rows[] = $normalized;
    }

    if (!saveOverrides($rows)) {
        respond(500, ['ok' => false, 'message' => 'Unable to save override.']);
    }

    auditEvent('override_saved', [
        'page' => $normalized['page'],
        'type' => $normalized['type'],
        'selector' => $normalized['selector'],
    ]);

    respond(200, ['ok' => true, 'item' => $normalized]);
}

if ($action === 'delete_override') {
    requireAuth();
    requireAllowedIp();
    requirePost();
    requireCsrfToken();
    $body = readJsonBody();

    $page = trim((string)($body['page'] ?? ''));
    $selector = trim((string)($body['selector'] ?? ''));
    $type = trim((string)($body['type'] ?? ''));
    $id = $page . '|' . $selector . '|' . $type;

    $rows = readOverrides();
    $next = [];
    $deleted = false;

    foreach ($rows as $row) {
        if (($row['id'] ?? '') === $id) {
            $deleted = true;
            continue;
        }
        $next[] = $row;
    }

    if (!$deleted) {
        respond(404, ['ok' => false, 'message' => 'Override not found.']);
    }

    if (!saveOverrides($next)) {
        respond(500, ['ok' => false, 'message' => 'Unable to save changes.']);
    }

    auditEvent('override_deleted', [
        'page' => $page,
        'type' => $type,
        'selector' => $selector,
    ]);

    respond(200, ['ok' => true]);
}

if ($action === 'reset_overrides') {
    requireAuth();
    requireAllowedIp();
    requirePost();
    requireCsrfToken();

    if (!saveOverrides([])) {
        respond(500, ['ok' => false, 'message' => 'Unable to reset overrides.']);
    }

    auditEvent('overrides_reset');

    respond(200, ['ok' => true]);
}

if ($action === 'change_password') {
    requireAuth();
    requireAllowedIp();
    requirePost();
    requireCsrfToken();

    $body = readJsonBody();
    $currentPassword = (string)($body['currentPassword'] ?? '');
    $newPassword = (string)($body['newPassword'] ?? '');

    if (strlen($newPassword) < 10) {
        respond(422, ['ok' => false, 'message' => 'New password must be at least 10 characters.']);
    }

    $config = readAdminConfig();
    $currentHash = hash('sha256', $currentPassword);
    if (!hash_equals((string)$config['passwordHash'], $currentHash)) {
        auditEvent('admin_change_password_failed');
        respond(401, ['ok' => false, 'message' => 'Current password is incorrect.']);
    }

    $newHash = hash('sha256', $newPassword);
    if (hash_equals((string)$config['passwordHash'], $newHash)) {
        respond(422, ['ok' => false, 'message' => 'New password must be different from current password.']);
    }

    $config['passwordHash'] = $newHash;
    if (!saveAdminConfig($config)) {
        respond(500, ['ok' => false, 'message' => 'Unable to update password.']);
    }

    bumpAuthVersion();

    auditEvent('admin_password_changed');

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();

    respond(200, ['ok' => true, 'requiresLogin' => true]);
}

if ($action === 'upload_image') {
    global $uploadMimeToExtension;

    requireAuth();
    requireAllowedIp();
    requirePost();
    requireCsrfToken();

    if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
        respond(422, ['ok' => false, 'message' => 'Missing image file upload.']);
    }

    $file = $_FILES['image'];
    $errorCode = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($errorCode !== UPLOAD_ERR_OK) {
        respond(422, ['ok' => false, 'message' => 'Upload failed with code ' . $errorCode . '.']);
    }

    $tmpPath = (string)($file['tmp_name'] ?? '');
    $size = (int)($file['size'] ?? 0);

    if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
        respond(422, ['ok' => false, 'message' => 'Invalid upload source.']);
    }

    if ($size <= 0 || $size > MAX_UPLOAD_BYTES) {
        respond(422, ['ok' => false, 'message' => 'File size must be between 1 byte and 6 MB.']);
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = $finfo ? (string)finfo_file($finfo, $tmpPath) : '';
    if ($finfo) {
        finfo_close($finfo);
    }

    if (!isset($uploadMimeToExtension[$mimeType])) {
        respond(422, ['ok' => false, 'message' => 'Unsupported image type. Use JPG, PNG, WEBP, GIF, or SVG.']);
    }

    if (!is_dir(UPLOAD_DIR) && !@mkdir(UPLOAD_DIR, 0775, true) && !is_dir(UPLOAD_DIR)) {
        respond(500, ['ok' => false, 'message' => 'Uploads directory is not available.']);
    }

    $extension = $uploadMimeToExtension[$mimeType];
    $filename = 'cms-' . date('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $extension;
    $destination = UPLOAD_DIR . DIRECTORY_SEPARATOR . $filename;

    if (!move_uploaded_file($tmpPath, $destination)) {
        respond(500, ['ok' => false, 'message' => 'Unable to store uploaded image.']);
    }

    auditEvent('image_uploaded', [
        'path' => 'uploads/' . $filename,
        'mime' => $mimeType,
        'size' => $size,
    ]);

    respond(200, ['ok' => true, 'path' => 'uploads/' . $filename]);
}

respond(404, ['ok' => false, 'message' => 'Unknown action.']);
