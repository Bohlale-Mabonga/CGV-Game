
const STORAGE_KEY = 'core-breach-settings-v2';
const PROGRESS_KEY = 'core-breach-progress-v2';

export const DEFAULT_SETTINGS = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  voice: true,
  sensitivity: 1.0,
  invertY: false,
  fov: 75,
  quality: 'high', // low | medium | high
  difficulty: 'normal', // story | normal | hard
  showFps: false,
  motionFx: true, // camera shake, chromatic aberration, head bob
  subtitles: true
};

export const DIFFICULTY = {
  story: { label: 'Story', timeScale: 1.5, damageScale: 0.5, beamSpeed: 0.75, chaseSpeed: 0.8 },
  normal: { label: 'Normal', timeScale: 1.0, damageScale: 1.0, beamSpeed: 1.0, chaseSpeed: 1.0 },
  hard: { label: 'Hard', timeScale: 0.8, damageScale: 1.5, beamSpeed: 1.3, chaseSpeed: 1.15 }
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — settings still apply for this session.
  }
}

class Settings {
  constructor() {
    this.values = readJson(STORAGE_KEY, DEFAULT_SETTINGS);
    // These are no longer exposed in the Options menu, so always use the
    // defaults (a value saved by an older version could not be changed back).
    for (const key of ['sensitivity', 'invertY', 'fov', 'motionFx', 'quality', 'showFps']) {
      this.values[key] = DEFAULT_SETTINGS[key];
    }
    this.listeners = new Set();
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    this.values[key] = value;
    writeJson(STORAGE_KEY, this.values);
    for (const listener of this.listeners) listener(key, value);
  }

  reset() {
    this.values = { ...DEFAULT_SETTINGS };
    writeJson(STORAGE_KEY, this.values);
    for (const key of Object.keys(this.values)) {
      for (const listener of this.listeners) listener(key, this.values[key]);
    }
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get difficulty() {
    return DIFFICULTY[this.values.difficulty] ?? DIFFICULTY.normal;
  }
}

class Progress {
  constructor() {
    this.values = readJson(PROGRESS_KEY, { unlocked: 1, bestTimes: {}, bestRank: null, logs: [] });
  }

  unlock(levelNumber) {
    if (levelNumber > this.values.unlocked) {
      this.values.unlocked = Math.min(levelNumber, 3);
      this.save();
    }
  }

  recordTime(key, seconds) {
    const best = this.values.bestTimes[key];
    const isRecord = best === undefined || seconds < best;
    if (isRecord) {
      this.values.bestTimes[key] = seconds;
      this.save();
    }
    return isRecord;
  }

  recordRank(rank) {
    const order = ['S', 'A', 'B', 'C', 'D'];
    const current = this.values.bestRank;
    if (!current || order.indexOf(rank) < order.indexOf(current)) {
      this.values.bestRank = rank;
      this.save();
    }
  }

  addLog(id) {
    if (!this.values.logs.includes(id)) {
      this.values.logs.push(id);
      this.save();
    }
  }

  save() {
    writeJson(PROGRESS_KEY, this.values);
  }
}

export const settings = new Settings();
export const progress = new Progress();
