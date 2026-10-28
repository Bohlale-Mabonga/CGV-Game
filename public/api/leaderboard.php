<?php
// Core Breach — online leaderboard API.
//
// A tiny JSON-over-HTTP service for the department web server. No database:
// scores live in one JSON file (data/leaderboard.php), read and written under
// an exclusive file lock so simultaneous submissions cannot corrupt it. The
// file is a .php whose first line exits, so opening it in a browser shows
// nothing (the server is nginx, which ignores .htaccess rules).
//
//   GET  leaderboard.php?difficulty=normal       → top 10 of every board
//   POST leaderboard.php   {name, difficulty, board, time, rank?, deaths, hints}
//                                                → saves it, returns the position
//
// Boards: "run" (full game, fastest total time) and "level1".."level3"
// (fastest level times), kept separately per difficulty.
// ?sandbox=1 uses a separate file, for testing without touching real scores.

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const TOP_N = 10;          // entries returned per board
const KEEP_N = 50;         // entries stored per board
const MIN_INTERVAL = 5;    // seconds between submissions from one player
const MAX_BODY = 2048;     // bytes
const DIFFICULTIES = ['story', 'normal', 'hard'];
// Plausible time ranges in seconds; anything outside is rejected.
const BOARDS = ['run' => [120, 7200], 'level1' => [20, 3600], 'level2' => [20, 3600], 'level3' => [20, 3600]];
const RANKS = ['S', 'A', 'B', 'C', 'D'];

function respond(array $body, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

$dataDir = __DIR__ . '/data';
$file = $dataDir . (isset($_GET['sandbox']) ? '/sandbox.php' : '/leaderboard.php');
const GUARD = "<?php http_response_code(404); exit; ?>\n";

if (!is_dir($dataDir) && !@mkdir($dataDir, 0755, true)) {
    respond(['ok' => false, 'error' => 'Storage unavailable'], 500);
}

// Open the store, lock it, let $fn read/modify it, and save if it changed.
function withStore(string $file, bool $write, callable $fn): array
{
    $handle = @fopen($file, 'c+');
    if ($handle === false) {
        respond(['ok' => false, 'error' => 'Storage unavailable'], 500);
    }
    flock($handle, $write ? LOCK_EX : LOCK_SH);
    $raw = (string)stream_get_contents($handle);
    if (str_starts_with($raw, GUARD)) {
        $raw = substr($raw, strlen(GUARD));
    }
    $data = $raw !== '' ? json_decode($raw, true) : null;
    if (!is_array($data)) {
        $data = ['boards' => [], 'clients' => []];
    }
    [$data, $result] = $fn($data);
    if ($write && $data !== null) {
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, GUARD . json_encode($data));
        fflush($handle);
    }
    flock($handle, LOCK_UN);
    fclose($handle);
    return $result;
}

function topOf(array $data, string $key): array
{
    return array_slice($data['boards'][$key] ?? [], 0, TOP_N);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ------------------------------------------------------------------ read --
if ($method === 'GET') {
    $difficulty = $_GET['difficulty'] ?? 'normal';
    if (!in_array($difficulty, DIFFICULTIES, true)) {
        respond(['ok' => false, 'error' => 'Unknown difficulty'], 400);
    }
    $boards = withStore($file, false, function (array $data) use ($difficulty) {
        $out = [];
        foreach (array_keys(BOARDS) as $board) {
            $out[$board] = topOf($data, "$difficulty:$board");
        }
        return [null, $out];
    });
    respond(['ok' => true, 'difficulty' => $difficulty, 'boards' => $boards]);
}

if ($method !== 'POST') {
    respond(['ok' => false, 'error' => 'Method not allowed'], 405);
}

// ----------------------------------------------------------------- write --
$body = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if ($body === false || strlen($body) > MAX_BODY) {
    respond(['ok' => false, 'error' => 'Request too large'], 413);
}
$in = json_decode($body, true);
if (!is_array($in)) {
    respond(['ok' => false, 'error' => 'Invalid JSON'], 400);
}

// Validate every field; never trust the client.
$name = preg_replace('/\s+/', ' ', trim((string)($in['name'] ?? '')));
if (!preg_match('/^[A-Za-z0-9 _-]{3,12}$/', $name)) {
    respond(['ok' => false, 'error' => 'Name must be 3-12 letters, numbers, spaces, - or _'], 400);
}
$difficulty = (string)($in['difficulty'] ?? '');
$board = (string)($in['board'] ?? '');
if (!in_array($difficulty, DIFFICULTIES, true) || !array_key_exists($board, BOARDS)) {
    respond(['ok' => false, 'error' => 'Unknown board'], 400);
}
$time = filter_var($in['time'] ?? null, FILTER_VALIDATE_FLOAT);
[$minTime, $maxTime] = BOARDS[$board];
if ($time === false || $time < $minTime || $time > $maxTime) {
    respond(['ok' => false, 'error' => 'That time is not valid for this board'], 400);
}
$rank = $board === 'run' ? (string)($in['rank'] ?? '') : '';
if ($board === 'run' && !in_array($rank, RANKS, true)) {
    respond(['ok' => false, 'error' => 'Invalid rank'], 400);
}
$deaths = max(0, min(999, (int)($in['deaths'] ?? 0)));
$hints = max(0, min(999, (int)($in['hints'] ?? 0)));

// A rough per-player identity for rate limiting (not stored in readable form).
$client = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? ''));
$now = time();

$result = withStore($file, true, function (array $data) use ($client, $now, $name, $difficulty, $board, $time, $rank, $deaths, $hints) {
    // Forget clients not seen for an hour, then apply the rate limit.
    $data['clients'] = array_filter($data['clients'] ?? [], fn($t) => $now - $t < 3600);
    if (isset($data['clients'][$client]) && $now - $data['clients'][$client] < MIN_INTERVAL) {
        return [null, ['error' => 'Too many submissions — wait a few seconds']];
    }
    $data['clients'][$client] = $now;

    $key = "$difficulty:$board";
    $id = bin2hex(random_bytes(6));
    $entry = [
        'id' => $id,
        'name' => $name,
        'time' => round($time, 1),
        'deaths' => $deaths,
        'hints' => $hints,
        'date' => gmdate('Y-m-d'),
    ];
    if ($rank !== '') {
        $entry['rank'] = $rank;
    }
    $list = $data['boards'][$key] ?? [];
    $list[] = $entry;
    usort($list, fn($a, $b) => $a['time'] <=> $b['time']);
    $total = count($list);
    $position = 1 + (int)array_search($id, array_column($list, 'id'), true);
    $data['boards'][$key] = array_slice($list, 0, KEEP_N);

    return [$data, ['id' => $id, 'position' => $position, 'total' => $total, 'top' => array_slice($list, 0, TOP_N)]];
});

if (isset($result['error'])) {
    respond(['ok' => false, 'error' => $result['error']], 429);
}
respond(['ok' => true] + $result);
