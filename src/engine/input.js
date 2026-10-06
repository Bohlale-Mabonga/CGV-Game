// Keyboard + mouse input. Continuous state (held keys, accumulated mouse delta)
// is polled by the game each frame; one-shot actions are queued as "pressed"
// flags that are cleared at the end of every frame.

const ACTION_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['KeyC', 'ControlLeft'],
  interact: ['KeyE'],
  flashlight: ['KeyF'],
  scan: ['KeyQ'],
  view: ['KeyV'],
  map: ['KeyM', 'Tab'],
  hint: ['KeyH'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter']
};

export class Input {
  constructor(element) {
    this.element = element;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.mouseDown = [false, false, false];
    this.mousePressed = [false, false, false];
    this.locked = false;
    this.enabled = true;
    this.onLockChange = null;
    this.onKey = null; // raw key hook for modal UIs (keypad)
    this.lastUnlockTime = 0;

    this.codeToAction = new Map();
    for (const [action, codes] of Object.entries(ACTION_KEYS)) {
      for (const code of codes) this.codeToAction.set(code, action);
    }

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    window.addEventListener('blur', () => this.releaseAll());

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // Ignore the occasional giant spike Chrome reports when the lock engages.
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    element.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      this.mouseDown[e.button] = true;
      this.mousePressed[e.button] = true;
    });
    window.addEventListener('mouseup', (e) => {
      this.mouseDown[e.button] = false;
    });
    element.addEventListener('contextmenu', (e) => e.preventDefault());
    element.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      const wasLocked = this.locked;
      this.locked = document.pointerLockElement === element;
      if (!this.locked) {
        this.lastUnlockTime = performance.now();
        this.releaseAll();
      }
      if (wasLocked !== this.locked) this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      this.onLockChange?.(false, true);
    });
  }

  handleKeyDown(e) {
    if (this.onKey && this.onKey(e)) {
      e.preventDefault();
      return;
    }
    const action = this.codeToAction.get(e.code);
    if (!action) return;
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) this.pressed.add(action);
    this.down.add(action);
  }

  handleKeyUp(e) {
    const action = this.codeToAction.get(e.code);
    if (!action) return;
    // Only release when no other bound key for this action is still held.
    this.down.delete(action);
  }

  releaseAll() {
    this.down.clear();
    this.mouseDown = [false, false, false];
  }

  isDown(action) {
    return this.enabled && this.down.has(action);
  }

  wasPressed(action) {
    return this.enabled && this.pressed.has(action);
  }

  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  requestLock() {
    // Chrome refuses a re-lock within ~1s of the user pressing Esc; retry quietly.
    const elapsed = performance.now() - this.lastUnlockTime;
    const attempt = () => {
      try {
        const result = this.element.requestPointerLock({ unadjustedMovement: true });
        if (result && typeof result.catch === 'function') {
          result.catch(() => {
            try {
              const fallback = this.element.requestPointerLock();
              fallback?.catch?.(() => {});
            } catch { /* ignored */ }
          });
        }
      } catch {
        /* ignored — the user can click the canvas again */
      }
    };
    if (elapsed < 1100) setTimeout(attempt, 1100 - elapsed);
    else attempt();
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  endFrame() {
    this.pressed.clear();
    this.mousePressed = [false, false, false];
  }
}
