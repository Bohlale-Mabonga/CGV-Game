// All 2D interface: menus, HUD, modals and overlays, built as DOM over the
// WebGL canvas. The Game drives it; it never touches game state directly
// except through the callbacks it is given.

import { settings, progress, DIFFICULTY } from '../engine/settings.js';
import { audio } from '../engine/audio.js';
import { CREDITS } from './credits.js';

const $ = (sel, root = document) => root.querySelector(sel);

function fmtTime(seconds) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  const t = Math.floor((s * 10) % 10);
  return `${m}:${String(r).padStart(2, '0')}.${t}`;
}

export { fmtTime };

const CONTROLS = [
  ['W A S D', 'Move'],
  ['Mouse', 'Look'],
  ['Space', 'Jump (×2 in mid-air: thrusters, Level 3)'],
  ['Shift', 'Sprint (uses stamina)'],
  ['C / Ctrl', 'Crouch'],
  ['E / Left click', 'Interact (hold for some objects)'],
  ['F', 'Flashlight on/off'],
  ['V / Mouse wheel', 'First / third-person camera · zoom'],
  ['M / Tab', 'Minimap size'],
  ['H', 'Hint (press again for more detail)'],
  ['Esc / P', 'Pause menu']
];

export class UI {
  constructor(root) {
    this.root = root;
    this.callbacks = {};
    this.toasts = [];
    this.scanEls = new Map();
    this.typing = null;
    root.innerHTML = TEMPLATE;
    this.el = {
      loading: $('#loading'), loadBar: $('#load-bar'), loadText: $('#load-text'),
      menu: $('#menu'), hud: $('#hud'), pause: $('#pause'),
      panel: $('#panel'), panelBody: $('#panel-body'), panelTitle: $('#panel-title'),
      intro: $('#intro'), result: $('#result'), modal: $('#modal'),
      objective: $('#objective-text'), timer: $('#timer'), timerValue: $('#timer-value'),
      integrity: $('#bar-integrity'), stamina: $('#bar-stamina'), battery: $('#bar-battery'),
      integrityVal: $('#val-integrity'), batteryWrap: $('#vital-battery'), flashIcon: $('#flash-state'),
      keycards: $('#keycards'), prompt: $('#prompt'), promptText: $('#prompt-text'), promptRing: $('#prompt-ring'),
      subtitle: $('#subtitle'), subtitleText: $('#subtitle-text'), hint: $('#hint'), hintText: $('#hint-text'),
      hintTier: $('#hint-tier'), toasts: $('#toasts'), fps: $('#fps'), detection: $('#detection'),
      detectionBar: $('#detection-bar'), minimapFrame: $('#minimap-frame'), scan: $('#scan-layer'),
      levelTag: $('#level-tag'), crosshair: $('#crosshair'), resume: $('#resume'), lowPower: $('#low-power'),
      scanCooldown: $('#scan-cd'), abilities: $('#abilities')
    };
    this.bindMenu();
    settings.onChange((key) => {
      if (key === 'showFps') this.el.fps.classList.toggle('hidden', !settings.get('showFps'));
    });
    this.el.fps.classList.toggle('hidden', !settings.get('showFps'));
    // UI hover/click sounds.
    root.addEventListener('mouseover', (e) => {
      if (e.target.closest('button')) audio.play('uiHover');
    });
    root.addEventListener('click', (e) => {
      if (e.target.closest('button')) audio.play('ui');
    });
  }

  on(name, fn) {
    this.callbacks[name] = fn;
  }

  emit(name, ...args) {
    this.callbacks[name]?.(...args);
  }

  // ---------------------------------------------------------------- loading --
  setLoading(fraction, text) {
    this.el.loadBar.style.width = `${Math.round(fraction * 100)}%`;
    if (text) this.el.loadText.textContent = text;
  }

  hideLoading() {
    this.el.loading.classList.add('fade-out');
    setTimeout(() => this.el.loading.classList.add('hidden'), 700);
  }

  // ------------------------------------------------------------------- menu --
  bindMenu() {
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      switch (action) {
        case 'new-game': this.emit('newGame'); break;
        case 'level-select': this.showLevelSelect(); break;
        case 'play-level': this.emit('playLevel', Number(btn.dataset.level)); break;
        case 'options': this.showOptions(); break;
        case 'controls': this.showControls(); break;
        case 'how-to-play': this.showHowToPlay(); break;
        case 'credits': this.showCredits(); break;
        case 'close-panel': this.closePanel(); break;
        case 'resume': this.emit('resume'); break;
        case 'restart-level': this.emit('restartLevel'); break;
        case 'restart-game': this.emit('restartGame'); break;
        case 'retry-checkpoint': this.emit('retryCheckpoint'); break;
        case 'quit': this.emit('quitToMenu'); break;
        case 'continue': this.emit('continue'); break;
        case 'reset-settings': settings.reset(); this.showOptions(); break;
        default: break;
      }
    });
  }

  showMenu() {
    this.hideAll();
    this.el.menu.classList.remove('hidden');
    const best = progress.values.bestRank;
    $('#menu-best').textContent = best ? `Best rank: ${best}` : 'No completed runs yet';
    $('#menu-difficulty').textContent = `Difficulty: ${settings.difficulty.label}`;
  }

  hideAll() {
    for (const k of ['menu', 'hud', 'pause', 'panel', 'intro', 'result', 'modal', 'resume']) this.el[k].classList.add('hidden');
    this.hideScan();
  }

  showLevelSelect() {
    const unlocked = progress.values.unlocked;
    const names = [['1', 'CORRIDORS', 'EXPLORE'], ['2', 'CONTROL ROOM', 'SOLVE'], ['3', 'MELTDOWN', 'ESCAPE']];
    const html = names.map(([n, name, verb]) => {
      const locked = Number(n) > unlocked;
      const best = progress.values.bestTimes[`level${n}`];
      return `<button class="level-card ${locked ? 'locked' : ''}" ${locked ? 'disabled' : `data-action="play-level" data-level="${n}"`}>
        <span class="lc-num">0${n}</span><span class="lc-name">${name}</span><span class="lc-verb">${verb}</span>
        <span class="lc-best">${locked ? '🔒 Complete the previous level' : best ? `Best ${fmtTime(best)}` : 'Not completed'}</span>
      </button>`;
    }).join('');
    this.openPanel('Level select', `<div class="level-grid">${html}</div>`);
  }

  showHowToPlay() {
    const html = `
      <div class="howto">
        <p class="howto-lead">You are <b>SPARK</b>, a small maintenance robot. The station's reactor is overheating and the crew are gone. Cross three levels, reach the core and seal it before it breaches.</p>
        <div class="howto-levels">
          <div><span>01 · EXPLORE</span>Search the dark corridors with your flashlight and find the three keycards. Then unlock the reactor access door.</div>
          <div><span>02 · SOLVE</span>Win the load diagnostic to learn the junction order, then switch the junctions on lowest load first while staying out of the sentry's beam.</div>
          <div><span>03 · ESCAPE</span>Outrun the fire, jump the lava (press Space twice for thrusters), and bring the three pylons online. Then seal the core.</div>
        </div>
        <h3>Staying alive</h3>
        <ul>
          <li>Steam, the sentry, debris, pistons and lava drain your <b>health</b>. At zero, SPARK reboots at the last checkpoint.</li>
          <li>Levels 2 and 3 have a <b>countdown</b>. If it reaches zero, the reactor breaches and you'll need to retry the level.</li>
        </ul>
        <h3>Tips</h3>
        <ul>
          <li>Follow the <b>objective</b> (top left) and the <b>map</b> (top right).</li>
          <li>Press <kbd>E</kbd> to use things. Some need you to <b>hold</b> it.</li>
          <li>Stuck? Press <kbd>H</kbd> for a hint. Press it again for more detail.</li>
          <li>Read the <b>data logs</b>: they tell the story and hide clues.</li>
          <li>Press <kbd>Esc</kbd> to pause, restart or change options.</li>
        </ul>
      </div>`;
    this.openPanel('How to play', html);
  }

  showControls() {
    const rows = CONTROLS.map(([k, v]) => `<div class="ctrl-row"><kbd>${k}</kbd><span>${v}</span></div>`).join('');
    this.openPanel('Controls', `<div class="ctrl-list">${rows}</div>`);
  }

  showCredits() {
    const sections = CREDITS.map((sec) => `<h3>${sec.heading}</h3>` + sec.items.map((it) =>
      `<div class="credit"><b>${it.name}</b>${it.by ? ` — ${it.by}` : ''}${it.licence ? ` <span class="lic">${it.licence}</span>` : ''}${it.url ? `<br><a href="${it.url}" target="_blank" rel="noopener">${it.url}</a>` : ''}${it.note ? `<br><span class="note">${it.note}</span>` : ''}</div>`).join('')).join('');
    this.openPanel('Credits', `<div class="credits">${sections}</div>`);
  }

  showOptions() {
    const s = settings.values;
    const slider = (key, label, min, max, step, fmt = (v) => v) => `
      <label class="opt"><span>${label}</span>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}" data-key="${key}">
        <output>${fmt(s[key])}</output></label>`;
    const toggle = (key, label) => `
      <label class="opt"><span>${label}</span><input type="checkbox" data-key="${key}" ${s[key] ? 'checked' : ''}><i class="switch"></i></label>`;
    const select = (key, label, options) => `
      <label class="opt"><span>${label}</span><select data-key="${key}">
        ${options.map(([v, l]) => `<option value="${v}" ${s[key] === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select></label>`;
    const pct = (v) => `${Math.round(v * 100)}%`;
    const html = `
      <div class="opt-cols">
        <div><h3>Audio</h3>
          ${slider('masterVolume', 'Master volume', 0, 1, 0.05, pct)}
          ${slider('musicVolume', 'Music', 0, 1, 0.05, pct)}
          ${slider('sfxVolume', 'Effects', 0, 1, 0.05, pct)}
          ${toggle('voice', 'ARIA voice (speech)')}
          ${toggle('subtitles', 'Subtitles')}
        </div>
        <div><h3>Game</h3>
          ${select('difficulty', 'Difficulty', Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label]))}
          <p class="note">Difficulty changes timers, damage and hazard speed. It applies from the next level load.</p>
          <button class="btn small" data-action="reset-settings">Reset to defaults</button>
        </div>
      </div>`;
    this.openPanel('Options', html);
    for (const input of this.el.panelBody.querySelectorAll('[data-key]')) {
      const key = input.dataset.key;
      const out = input.parentElement.querySelector('output');
      input.addEventListener('input', () => {
        let value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
        settings.set(key, value);
        if (out) out.textContent = key.includes('Volume') ? pct(value) : key === 'fov' ? `${value}°` : key === 'sensitivity' ? Number(value).toFixed(1) : value;
      });
    }
  }

  openPanel(title, html) {
    this.el.panelTitle.textContent = title;
    this.el.panelBody.innerHTML = html;
    this.el.panel.classList.remove('hidden');
  }

  closePanel() {
    this.el.panel.classList.add('hidden');
    if (!this.el.menu.classList.contains('hidden')) this.showMenu();
  }

  get panelOpen() {
    return !this.el.panel.classList.contains('hidden');
  }

  // ------------------------------------------------------------------ pause --
  showPause(visible) {
    this.el.pause.classList.toggle('hidden', !visible);
    if (!visible) this.el.panel.classList.add('hidden');
  }

  showResume(visible) {
    this.el.resume.classList.toggle('hidden', !visible);
  }

  // -------------------------------------------------------------------- HUD --
  showHud(visible) {
    this.el.hud.classList.toggle('hidden', !visible);
  }

  setLevelTag(meta) {
    this.el.levelTag.innerHTML = `<b>0${meta.number}</b> ${meta.name} <i>${meta.verb}</i>`;
  }

  setObjective(text) {
    if (this._objective === text) return;
    this._objective = text;
    this.el.objective.textContent = text;
    this.el.objective.parentElement.classList.remove('flash');
    void this.el.objective.offsetWidth;
    this.el.objective.parentElement.classList.add('flash');
  }

  setTimer(seconds, total) {
    if (seconds === null) {
      this.el.timer.classList.add('hidden');
      return;
    }
    this.el.timer.classList.remove('hidden');
    this.el.timerValue.textContent = fmtTime(seconds);
    this.el.timer.classList.toggle('urgent', seconds < 30);
    this.el.timer.style.setProperty('--frac', `${Math.max(0, seconds / total) * 100}%`);
  }

  setVitals({ integrity, stamina, battery, flashlightOn, exhausted }) {
    this.el.integrity.style.width = `${integrity}%`;
    this.el.integrityVal.textContent = Math.ceil(integrity);
    this.el.integrity.parentElement.classList.toggle('critical', integrity < 30);
    this.el.stamina.style.width = `${stamina}%`;
    this.el.stamina.parentElement.classList.toggle('exhausted', !!exhausted);
    this.el.battery.style.width = `${battery}%`;
    this.el.battery.parentElement.classList.toggle('low', battery < 20);
    this.el.flashIcon.textContent = flashlightOn ? 'ON' : 'OFF';
    this.el.lowPower.classList.toggle('hidden', integrity >= 30);
  }

  setAbilities(list) {
    this.el.abilities.innerHTML = list.map((a) => `<span class="ability">${a}</span>`).join('');
  }

  setScanCooldown(fraction) {
    this.el.scanCooldown.style.setProperty('--cd', `${Math.round(fraction * 100)}%`);
    this.el.scanCooldown.classList.toggle('ready', fraction <= 0);
  }

  setKeycards(cards) {
    if (!cards) {
      this.el.keycards.innerHTML = '';
      return;
    }
    this.el.keycards.innerHTML = cards.map((c) =>
      `<span class="kc ${c.have ? 'have' : ''}" style="--c:${c.color}"></span>`).join('');
  }

  setPrompt(text, holdFraction = 0, hold = false) {
    if (!text) {
      this.el.prompt.classList.add('hidden');
      return;
    }
    this.el.prompt.classList.remove('hidden');
    if (this._prompt !== text) {
      this._prompt = text;
      this.el.promptText.textContent = text;
    }
    this.el.prompt.classList.toggle('hold', hold);
    this.el.promptRing.style.setProperty('--p', `${holdFraction * 100}%`);
  }

  setDetection(value) {
    if (value <= 0.01) {
      this.el.detection.classList.add('hidden');
      return;
    }
    this.el.detection.classList.remove('hidden');
    this.el.detectionBar.style.width = `${value * 100}%`;
  }

  setFps(fps) {
    this.el.fps.textContent = `${Math.round(fps)} FPS`;
  }

  setMinimap(size, visible) {
    const f = this.el.minimapFrame;
    f.classList.toggle('hidden', !visible);
    f.style.width = f.style.height = `${size}px`;
  }

  toast(text, color = '#37c8ff') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.setProperty('--c', color);
    el.textContent = text;
    this.el.toasts.prepend(el);
    setTimeout(() => el.classList.add('out'), 2800);
    setTimeout(() => el.remove(), 3400);
    while (this.el.toasts.children.length > 4) this.el.toasts.lastChild.remove();
  }

  // ARIA subtitles with a typewriter effect.
  say(text, speaker = 'ARIA') {
    if (!settings.get('subtitles')) return;
    clearInterval(this.typing);
    clearTimeout(this.subTimeout);
    this.el.subtitle.classList.remove('hidden');
    $('#subtitle-speaker').textContent = speaker;
    let i = 0;
    this.el.subtitleText.textContent = '';
    this.typing = setInterval(() => {
      i += 2;
      this.el.subtitleText.textContent = text.slice(0, i);
      if (i % 6 === 0) audio.play('type', { volume: 0.5 });
      if (i >= text.length) clearInterval(this.typing);
    }, 22);
    this.subTimeout = setTimeout(() => this.el.subtitle.classList.add('hidden'), 2500 + text.length * 55);
  }

  clearSubtitle() {
    clearInterval(this.typing);
    this.el.subtitle.classList.add('hidden');
  }

  showHint(text, tier, total) {
    this.el.hintText.textContent = text;
    this.el.hintTier.textContent = total > 1 ? `Hint ${tier}/${total}${tier < total ? ' · press H for more' : ''}` : 'Hint';
    this.el.hint.classList.remove('hidden');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.el.hint.classList.add('hidden'), 9000);
  }

  hintPrompt(text) {
    this.toast(text, '#ffb020');
  }

  // ---------------------------------------------------------- scanner tags --
  showScan(items) {
    this.el.scan.classList.remove('hidden');
    this.el.scan.innerHTML = '';
    this.scanEls.clear();
    for (const item of items) {
      const el = document.createElement('div');
      el.className = 'scan-tag';
      el.style.setProperty('--c', item.color);
      el.innerHTML = `<span class="diamond"></span><span class="lbl">${item.label}</span><span class="dist"></span>`;
      this.el.scan.appendChild(el);
      this.scanEls.set(item, el);
    }
  }

  updateScan(project, fade) {
    for (const [item, el] of this.scanEls) {
      const p = project(item.position);
      if (!p) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      el.style.opacity = fade;
      el.querySelector('.dist').textContent = `${p.distance.toFixed(0)} m`;
    }
  }

  hideScan() {
    this.el.scan.classList.add('hidden');
    this.scanEls.clear();
  }

  // -------------------------------------------------------- intro / results --
  showIntro(meta, skippable = true) {
    this.el.intro.innerHTML = `
      <div class="intro-card">
        <div class="intro-num">LEVEL 0${meta.number}</div>
        <div class="intro-name">${meta.name}</div>
        <div class="intro-verb">${meta.verb}</div>
        <div class="intro-tag">${meta.tagline}</div>
      </div>
      ${skippable ? '<div class="intro-skip">Click or press Space to skip</div>' : ''}`;
    this.el.intro.classList.remove('hidden');
  }

  hideIntro() {
    this.el.intro.classList.add('hidden');
  }

  showResult({ kind, title, subtitle, stats = [], buttons = [], rank = null, record = false }) {
    const statHtml = stats.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    const buttonHtml = buttons.map(([action, label, primary]) => `<button class="btn ${primary ? 'primary' : ''}" data-action="${action}">${label}</button>`).join('');
    this.el.result.className = `screen result ${kind}`;
    this.el.result.innerHTML = `
      <div class="result-card">
        <div class="result-title">${title}</div>
        <div class="result-sub">${subtitle}</div>
        ${rank ? `<div class="rank">RANK <b>${rank}</b>${record ? '<span class="record">NEW BEST</span>' : ''}</div>` : ''}
        <div class="stats">${statHtml}</div>
        <div class="result-buttons">${buttonHtml}</div>
      </div>`;
    this.el.result.classList.remove('hidden');
  }

  hideResult() {
    this.el.result.classList.add('hidden');
  }

  // ----------------------------------------------------------------- modals --
  closeModal() {
    this.el.modal.classList.add('hidden');
    this.el.modal.innerHTML = '';
    this.modalKey = null;
  }

  showLog(log, onClose) {
    this.el.modal.innerHTML = `
      <div class="modal-card log">
        <div class="log-id">${log.id}</div>
        <div class="log-title">${log.title}</div>
        <div class="log-body">${log.body.replace(/\n/g, '<br>')}</div>
        <button class="btn primary" id="modal-close">Close [E]</button>
      </div>`;
    this.el.modal.classList.remove('hidden');
    const close = () => {
      this.closeModal();
      onClose?.();
    };
    $('#modal-close').addEventListener('click', close);
    this.modalKey = (e) => {
      if (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Enter') {
        close();
        return true;
      }
      return false;
    };
  }

  showKeypad(onSubmit, onClose) {
    let entry = '';
    this.el.modal.innerHTML = `
      <div class="modal-card keypad">
        <div class="kp-title">COOLANT PUMPS · ACCESS</div>
        <div class="kp-display" id="kp-display">_ _ _ _</div>
        <div class="kp-grid">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="kp-btn" data-k="${n}">${n}</button>`).join('')}
          <button class="kp-btn alt" data-k="C">CLR</button><button class="kp-btn" data-k="0">0</button><button class="kp-btn ok" data-k="OK">OK</button>
        </div>
        <div class="kp-help">Click the keys or type digits · Enter to submit · Esc to leave</div>
      </div>`;
    this.el.modal.classList.remove('hidden');
    const display = $('#kp-display');
    const card = this.el.modal.querySelector('.keypad');
    const render = () => {
      display.textContent = entry.padEnd(4, '_').split('').join(' ');
    };
    const press = (k) => {
      if (k === 'C') {
        entry = '';
        audio.play('beep', { pitch: 0.7 });
      } else if (k === 'OK') {
        if (onSubmit(entry)) {
          audio.play('success');
          display.textContent = 'OPEN';
          card.classList.add('ok');
          this.closeModal();
          onClose?.(true);
          return;
        }
        audio.play('error');
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        entry = '';
      } else if (entry.length < 4) {
        entry += k;
        audio.play('beep', { pitch: 0.9 + Number(k) * 0.04 });
      }
      render();
    };
    this.el.modal.querySelectorAll('.kp-btn').forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
    this.modalKey = (e) => {
      if (/^Digit\d$|^Numpad\d$/.test(e.code)) press(e.code.slice(-1));
      else if (e.code === 'Backspace') { entry = entry.slice(0, -1); render(); }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') press('OK');
      else if (e.code === 'Escape') { this.closeModal(); onClose?.(false); }
      else return false;
      return true;
    };
  }

  // Load diagnostic: a signal-memory minigame. Pads flash a sequence; the player
  // repeats it (mouse or keys 1–4). Three rounds of length 3, 4 and 5; a
  // mistake replays the round. onWin() returns the result lines to display.
  showSignalGame(onWin, onClose) {
    const PADS = [
      { color: '#37c8ff', pitch: 0.62 }, { color: '#ffb020', pitch: 0.78 },
      { color: '#37ff8b', pitch: 0.94 }, { color: '#ff4fd8', pitch: 1.12 }
    ];
    const LENGTHS = [3, 4, 5];
    this.el.modal.innerHTML = `
      <div class="modal-card signal">
        <div class="kp-title">LOAD DIAGNOSTIC · SIGNAL TEST</div>
        <div class="sg-help">Watch the pads, then repeat the signal. Pass all three rounds to unscramble the junction readings.</div>
        <div class="sg-rounds">${LENGTHS.map(() => '<span class="sg-dot"></span>').join('')}</div>
        <div class="sg-status" id="sg-status">GET READY…</div>
        <div class="sg-grid">${PADS.map((p, i) => `<button class="sg-pad" data-p="${i}" style="--c:${p.color}">${i + 1}</button>`).join('')}</div>
        <div class="sg-result hidden" id="sg-result"></div>
        <button class="btn" id="sg-close">Leave terminal [Esc]</button>
      </div>`;
    this.el.modal.classList.remove('hidden');
    const card = this.el.modal.querySelector('.signal');
    const status = $('#sg-status');
    const pads = [...card.querySelectorAll('.sg-pad')];
    const dots = [...card.querySelectorAll('.sg-dot')];
    const timers = [];
    let round = 0, seq = [], input = [], accepting = false, done = false;
    const later = (ms, fn) => timers.push(setTimeout(() => { if (card.isConnected) fn(); }, ms));
    const flash = (p, ms) => {
      pads[p].classList.add('lit');
      audio.play('beep', { pitch: PADS[p].pitch });
      later(ms, () => pads[p].classList.remove('lit'));
    };
    const play = () => {
      accepting = false;
      input = [];
      status.textContent = 'WATCH THE SIGNAL';
      status.className = 'sg-status';
      seq.forEach((p, i) => later(700 + i * 650, () => flash(p, 420)));
      later(700 + seq.length * 650, () => {
        accepting = true;
        status.textContent = `REPEAT IT · ${seq.length} PULSES`;
      });
    };
    const newRound = () => {
      seq = Array.from({ length: LENGTHS[round] }, () => (Math.random() * 4) | 0);
      play();
    };
    const close = () => {
      timers.forEach(clearTimeout);
      this.closeModal();
      onClose?.(done);
    };
    const press = (p) => {
      if (!accepting || done) return;
      flash(p, 180);
      input.push(p);
      const i = input.length - 1;
      if (input[i] !== seq[i]) {
        accepting = false;
        audio.play('error');
        status.textContent = 'SIGNAL LOST · REPLAYING';
        status.className = 'sg-status bad';
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        later(1100, play);
        return;
      }
      if (input.length < seq.length) return;
      accepting = false;
      dots[round].classList.add('on');
      round++;
      if (round < LENGTHS.length) {
        status.textContent = 'ROUND CLEAR';
        status.className = 'sg-status good';
        audio.play('success', { volume: 0.6 });
        later(900, newRound);
        return;
      }
      done = true;
      audio.play('success');
      status.textContent = 'DIAGNOSTIC COMPLETE';
      status.className = 'sg-status good';
      card.classList.add('solved');
      const lines = onWin() ?? [];
      const result = $('#sg-result');
      result.innerHTML = `<div class="sg-result-title">JUNCTION ORDER · LOWEST LOAD FIRST</div>${lines.map((l) => `<div>${l}</div>`).join('')}`;
      result.classList.remove('hidden');
      $('#sg-close').textContent = 'Continue [Enter]';
    };
    pads.forEach((b, i) => b.addEventListener('click', () => press(i)));
    $('#sg-close').addEventListener('click', close);
    this.modalKey = (e) => {
      const m = /^(Digit|Numpad)([1-4])$/.exec(e.code);
      if (m) press(Number(m[2]) - 1);
      else if (e.code === 'Escape' || (done && (e.code === 'Enter' || e.code === 'KeyE'))) close();
      else return false;
      return true;
    };
    later(500, newRound);
  }

  // Power-routing grid: rotate pipe tiles to connect source → output.
  showRoutingGrid(onSolved, onClose) {
    const N = 5;
    const DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]]; // dx, dy, bit (N E S W)
    const opposite = { 1: 4, 2: 8, 4: 1, 8: 2 };
    const rot = (mask, r) => {
      let m = mask;
      for (let i = 0; i < r; i++) m = ((m << 1) | (m >> 3)) & 15;
      return m;
    };
    const srcRow = Math.floor(Math.random() * N);
    const dstRow = Math.floor(Math.random() * N);
    // Random self-avoiding path (DFS) from the west edge to the east edge.
    const visited = new Set();
    const path = [];
    const dfs = (x, y) => {
      visited.add(`${x},${y}`);
      path.push([x, y]);
      if (x === N - 1 && y === dstRow && path.length >= N + 2) return true;
      const order = [...DIRS].sort(() => Math.random() - 0.5);
      for (const [dx, dy] of order) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || visited.has(`${nx},${ny}`)) continue;
        if (dfs(nx, ny)) return true;
      }
      path.pop();
      return false;
    };
    if (!dfs(0, srcRow)) {
      path.length = 0;
      for (let x = 0; x < N; x++) path.push([x, srcRow]);
    }
    const tiles = Array.from({ length: N * N }, () => ({ base: 0, r: 0 }));
    const decoys = [5, 3, 7, 10, 6];
    tiles.forEach((t) => { t.base = decoys[(Math.random() * decoys.length) | 0]; });
    path.forEach(([x, y], i) => {
      let mask = 0;
      const prev = path[i - 1];
      const next = path[i + 1];
      if (!prev) mask |= 8; else mask |= DIRS.find(([dx, dy]) => dx === prev[0] - x && dy === prev[1] - y)[2];
      if (!next) mask |= 2; else mask |= DIRS.find(([dx, dy]) => dx === next[0] - x && dy === next[1] - y)[2];
      tiles[y * N + x].base = mask;
    });
    for (const t of tiles) t.r = (Math.random() * 4) | 0;

    const powered = () => {
      const on = new Set();
      const start = tiles[srcRow * N];
      if (!(rot(start.base, start.r) & 8)) return { on, solved: false };
      const queue = [[0, srcRow]];
      on.add(srcRow * N);
      while (queue.length) {
        const [x, y] = queue.shift();
        const m = rot(tiles[y * N + x].base, tiles[y * N + x].r);
        for (const [dx, dy, bit] of DIRS) {
          if (!(m & bit)) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          const idx = ny * N + nx;
          if (on.has(idx)) continue;
          if (rot(tiles[idx].base, tiles[idx].r) & opposite[bit]) {
            on.add(idx);
            queue.push([nx, ny]);
          }
        }
      }
      const end = tiles[dstRow * N + N - 1];
      return { on, solved: on.has(dstRow * N + N - 1) && (rot(end.base, end.r) & 2) > 0 };
    };
    // Make sure it does not start solved.
    while (powered().solved) tiles[srcRow * N].r = (tiles[srcRow * N].r + 1) % 4;

    const arm = { 1: 'M50 50 V0', 2: 'M50 50 H100', 4: 'M50 50 V100', 8: 'M50 50 H0' };
    const svgFor = (mask) => {
      const d = [1, 2, 4, 8].filter((b) => mask & b).map((b) => arm[b]).join(' ');
      return `<svg viewBox="0 0 100 100"><path class="pipe-bg" d="${d}"/><path class="pipe" d="${d}"/><circle cx="50" cy="50" r="12" class="hub"/></svg>`;
    };
    this.el.modal.innerHTML = `
      <div class="modal-card routing">
        <div class="kp-title">MASTER CONSOLE · POWER ROUTING</div>
        <div class="rg-help">Rotate the conduits to carry power from <b class="src">SOURCE</b> to <b class="dst">CORE FEED</b>. Left click rotates clockwise, right click anticlockwise.</div>
        <div class="rg-wrap">
          <div class="rg-port src" style="top:${srcRow * 20 + 10}%">⚡</div>
          <div class="rg-grid" id="rg-grid">${tiles.map((t, i) => `<div class="rg-tile" data-i="${i}" data-angle="${t.r * 90}" style="--r:${t.r * 90}deg">${svgFor(t.base)}</div>`).join('')}</div>
          <div class="rg-port dst" style="top:${dstRow * 20 + 10}%">◉</div>
        </div>
        <div class="rg-status" id="rg-status">CONDUITS MISALIGNED</div>
        <button class="btn" id="rg-close">Leave console [Esc]</button>
      </div>`;
    this.el.modal.classList.remove('hidden');
    const grid = $('#rg-grid');
    const status = $('#rg-status');
    const card = this.el.modal.querySelector('.routing');
    let solved = false;
    const refresh = () => {
      const { on, solved: done } = powered();
      grid.querySelectorAll('.rg-tile').forEach((el, i) => el.classList.toggle('on', on.has(i)));
      if (done && !solved) {
        solved = true;
        card.classList.add('solved');
        status.textContent = 'POWER ROUTED — CLICK TO CONTINUE';
        audio.play('success');
        onSolved();
        const finish = () => {
          this.closeModal();
          onClose?.(true);
        };
        card.addEventListener('click', finish, { once: true });
        this.modalKey = (e) => {
          if (['Enter', 'Escape', 'Space', 'KeyE'].includes(e.code)) {
            finish();
            return true;
          }
          return false;
        };
      }
    };
    const turn = (el, dir) => {
      if (solved) return;
      const t = tiles[Number(el.dataset.i)];
      t.r = (t.r + dir + 4) % 4;
      // Accumulate the visual angle so the CSS transition always turns the short way.
      const angle = Number(el.dataset.angle) + dir * 90;
      el.dataset.angle = String(angle);
      el.style.setProperty('--r', `${angle}deg`);
      audio.play('tile', { pitch: dir > 0 ? 1 : 0.85 });
      refresh();
    };
    grid.addEventListener('click', (e) => {
      const el = e.target.closest('.rg-tile');
      if (el) turn(el, 1);
    });
    grid.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const el = e.target.closest('.rg-tile');
      if (el) turn(el, -1);
    });
    $('#rg-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeModal();
      onClose?.(solved);
    });
    this.modalKey = (e) => {
      if (e.code === 'Escape') {
        this.closeModal();
        onClose?.(solved);
        return true;
      }
      return false;
    };
    refresh();
  }
}

const TEMPLATE = /* html */ `
<div id="loading" class="screen loading">
  <div class="load-logo"><span class="core-dot"></span>CORE BREACH</div>
  <div class="load-sub">Reactor Protocol</div>
  <div class="load-track"><div id="load-bar"></div></div>
  <div id="load-text">Booting maintenance unit…</div>
</div>

<div id="menu" class="screen menu hidden">
  <div class="menu-left">
    <div class="title"><span class="t1">CORE</span><span class="t2">BREACH</span></div>
    <div class="tagline">A maintenance robot. An overheating reactor. Three levels to seal the core.</div>
    <nav class="menu-buttons">
      <button class="btn primary" data-action="new-game">New game</button>
      <button class="btn" data-action="level-select">Level select</button>
      <button class="btn" data-action="how-to-play">How to play</button>
      <button class="btn" data-action="options">Options</button>
      <button class="btn" data-action="controls">Controls</button>
      <button class="btn" data-action="credits">Credits</button>
    </nav>
    <div class="menu-foot"><span id="menu-best"></span> · <span id="menu-difficulty"></span></div>
  </div>
</div>

<div id="panel" class="screen panel hidden">
  <div class="panel-card">
    <div class="panel-head"><h2 id="panel-title"></h2><button class="btn small" data-action="close-panel">Back</button></div>
    <div id="panel-body"></div>
  </div>
</div>

<div id="pause" class="screen pause hidden">
  <div class="pause-card">
    <h2>PAUSED</h2>
    <button class="btn primary" data-action="resume">Resume</button>
    <button class="btn" data-action="retry-checkpoint">Restart from checkpoint</button>
    <button class="btn" data-action="restart-level">Restart level</button>
    <button class="btn" data-action="restart-game">Restart game</button>
    <button class="btn" data-action="how-to-play">How to play</button>
    <button class="btn" data-action="options">Options</button>
    <button class="btn" data-action="controls">Controls</button>
    <button class="btn" data-action="quit">Quit to main menu</button>
  </div>
</div>

<div id="resume" class="screen resume hidden"><div>Click to resume</div></div>

<div id="hud" class="hud hidden">
  <div id="level-tag" class="level-tag"></div>
  <div class="objective"><span class="obj-label">OBJECTIVE</span><span id="objective-text"></span></div>
  <div id="timer" class="timer hidden"><span class="timer-label">CORE BREACH IN</span><span id="timer-value">0:00</span><div class="timer-track"></div></div>
  <div id="detection" class="detection hidden"><span>SENTRY LOCK</span><div class="det-track"><div id="detection-bar"></div></div></div>
  <div class="vitals">
    <div class="vital"><span class="v-label">HEALTH</span><div class="v-track integrity"><div id="bar-integrity"></div></div><span id="val-integrity" class="v-val">100</span></div>
    <div class="vital"><span class="v-label">STAMINA</span><div class="v-track stamina"><div id="bar-stamina"></div></div></div>
    <div class="vital" id="vital-battery"><span class="v-label">LIGHT <i id="flash-state">ON</i></span><div class="v-track battery"><div id="bar-battery"></div></div></div>
    <div class="hud-row"><div id="keycards" class="keycards"></div><div id="scan-cd" class="scan-cd ready" title="Scanner (Q)">Q</div><div id="abilities"></div></div>
  </div>
  <div id="minimap-frame" class="minimap-frame"><span>TACTICAL MAP · M</span></div>
  <div id="crosshair" class="crosshair"></div>
  <div id="prompt" class="prompt hidden"><div id="prompt-ring" class="ring"></div><kbd>E</kbd><span id="prompt-text"></span></div>
  <div id="subtitle" class="subtitle hidden"><span id="subtitle-speaker">ARIA</span><span id="subtitle-text"></span></div>
  <div id="hint" class="hint hidden"><span id="hint-tier">Hint</span><span id="hint-text"></span></div>
  <div id="toasts" class="toasts"></div>
  <div id="low-power" class="low-power hidden">⚠ HEALTH CRITICAL</div>
  <div id="fps" class="fps hidden"></div>
  <div id="scan-layer" class="scan-layer hidden"></div>
</div>

<div id="intro" class="screen intro hidden"></div>
<div id="result" class="screen result hidden"></div>
<div id="modal" class="screen modal hidden"></div>
`;
