// Leaderboard client. Talks to api/leaderboard.php on the LAMP server; when
// that is unreachable (offline, or the Vite dev server, which cannot run PHP)
// it falls back to a leaderboard stored on this computer, so the feature
// always works.

const API = './api/leaderboard.php';
const LOCAL_KEY = 'core-breach-local-leaderboard';
const NAME_KEY = 'core-breach-player-name';
const MINE_KEY = 'core-breach-my-scores';
const TOP_N = 10;
export const BOARDS = ['run', 'level1', 'level2', 'level3'];

function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable */ }
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    const body = await response.json(); // a non-PHP server returns the source: JSON fails → offline
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

export const leaderboard = {
  getName() {
    return readLocal(NAME_KEY, '');
  },

  setName(name) {
    writeLocal(NAME_KEY, name);
  },

  isMine(id) {
    return readLocal(MINE_KEY, []).includes(id);
  },

  rememberMine(id) {
    const mine = readLocal(MINE_KEY, []);
    mine.push(id);
    writeLocal(MINE_KEY, mine.slice(-100));
  },

  // Names: 3–12 letters, digits, spaces, - or _ (the server checks the same).
  cleanName(name) {
    const clean = String(name).trim().replace(/\s+/g, ' ');
    return /^[A-Za-z0-9 _-]{3,12}$/.test(clean) ? clean : null;
  },

  // → { online, boards: { run: [...], level1: [...], ... } }
  async fetchTop(difficulty) {
    try {
      const { body } = await request(`${API}?difficulty=${encodeURIComponent(difficulty)}`);
      if (body?.ok) return { online: true, boards: body.boards };
    } catch { /* offline */ }
    const local = readLocal(LOCAL_KEY, {});
    const boards = {};
    for (const b of BOARDS) boards[b] = (local[`${difficulty}:${b}`] ?? []).slice(0, TOP_N);
    return { online: false, boards };
  },

  // entry: { name, difficulty, board, time, rank?, deaths, hints }
  // → { ok, online, position, total, error? }
  async submit(entry) {
    try {
      const { body } = await request(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (body?.ok) {
        this.rememberMine(body.id);
        return { ok: true, online: true, position: body.position, total: body.total };
      }
      if (body?.error) return { ok: false, online: true, error: body.error };
    } catch { /* offline: fall through */ }
    return this.submitLocal(entry);
  },

  submitLocal(entry) {
    const local = readLocal(LOCAL_KEY, {});
    const key = `${entry.difficulty}:${entry.board}`;
    const id = Math.random().toString(16).slice(2, 14);
    const record = {
      id, name: entry.name, time: Math.round(entry.time * 10) / 10,
      deaths: entry.deaths, hints: entry.hints, date: new Date().toISOString().slice(0, 10)
    };
    if (entry.rank) record.rank = entry.rank;
    const list = [...(local[key] ?? []), record].sort((a, b) => a.time - b.time);
    const position = list.findIndex((r) => r.id === id) + 1;
    local[key] = list.slice(0, 50);
    writeLocal(LOCAL_KEY, local);
    this.rememberMine(id);
    return { ok: true, online: false, position, total: list.length };
  }
};
