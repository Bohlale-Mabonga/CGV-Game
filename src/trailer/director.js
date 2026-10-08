// TRAILER DIRECTOR — open the game with ?trailer to use it.
//
// Turns the real game into a deterministic film set. The normal frame loop is
// stopped; an external capture script calls __trailer.frame(i) for every
// frame, which sets up the right shot (loading a fresh level when needed),
// puppets SPARK, moves the camera, advances the game by exactly 1/FPS and
// renders. Title cards are DOM overlays animated from the same clock, and the
// soundtrack is rendered offline from the game's own synthesiser so it lines
// up with the picture to the sample.

import * as THREE from 'three';
import { settings } from '../engine/settings.js';
import { AudioEngine } from '../engine/audio.js';
import { LEVELS, LEVEL_FX } from '../game/game.js';

const FPS = 30;
const DURATION = 110;
const _v = new THREE.Vector3();
const _look = new THREE.Vector3();

export async function setupTrailer(game) {
  const engine = game.engine;
  engine.renderer.setAnimationLoop(null);
  engine.adapt = () => {};
  engine.resolutionScale = 1;
  // Trailer-only settings (not persisted).
  Object.assign(settings.values, { voice: false, subtitles: false, motionFx: true, quality: 'high', fov: 60, difficulty: 'normal' });
  engine.resize();
  game.ui.hideAll();
  document.body.style.cursor = 'none';

  const overlay = buildOverlay();
  const director = new Director(game, overlay);
  window.__trailer = {
    fps: FPS,
    duration: DURATION,
    frames: Math.round(DURATION * FPS),
    frame: (i) => director.frame(i),
    renderAudio: () => renderSoundtrack(),
    audioChunk: (i, size) => audioChunk(i, size)
  };
  window.__trailerReady = true;
}

// ---------------------------------------------------------------------------
// Director
// ---------------------------------------------------------------------------
class Director {
  constructor(game, overlay) {
    this.game = game;
    this.overlay = overlay;
    this.shot = null;
    this.loadedIndex = -1;
    this.shots = buildShotList();
  }

  async loadLevel(index) {
    const game = this.game;
    if (game.level) {
      game.level.dispose();
      game.level = null;
    }
    game.physics.clear();
    game.scene.fog = null;
    const level = new LEVELS[index](game);
    game.level = level;
    game.levelIndex = index;
    level.build();
    game.scene.add(level.root);
    game.buildMinimapForLevel(level);
    const fx = LEVEL_FX[index];
    game.engine.fx.uTint.value.set(...fx.tint);
    game.engine.fx.uVignette.value = fx.vignette + 0.1;
    game.engine.setBloom(fx.bloom);
    game.engine.renderer.toneMappingExposure = fx.exposure;
    game.engine.setView(game.scene, game.camera);
    game.player.battery = 100;
    game.player.integrity = 100;
    game.player.crouching = false;
    game.player.body.height = game.player.body.standHeight;
    await game.engine.compile(game.scene, game.camera);
    this.loadedIndex = index;
  }

  async frame(i) {
    const t = i / FPS;
    const dt = 1 / FPS;
    const game = this.game;
    const shot = this.shots.find((s) => t >= s.start && t < s.end) ?? this.shots[this.shots.length - 1];
    if (shot !== this.shot) {
      this.shot = shot;
      game.ui.showHud(false);
      game.engine.minimap = null;
      game.ui.hideScan();
      game.ui.closeModal();
      if (shot.level === 'menu') {
        game.engine.setView(game.menuScene, game.menuCamera);
        game.engine.setBloom(0.9);
        game.engine.renderer.toneMappingExposure = 1;
        game.engine.fx.uTint.value.set(1, 1, 1);
      } else {
        await this.loadLevel(shot.level);
        game.level.time = shot.levelTime ?? 0;
      }
      game.state = 'trailer';
      game.player.frozen = true;
      this.ctx = makeContext(game, shot);
      shot.setup?.(this.ctx);
    }
    const local = t - shot.start;
    const ctx = this.ctx;
    ctx.t = local;
    ctx.k = local / (shot.end - shot.start);
    ctx.dt = dt;
    ctx.global = t;

    if (shot.level === 'menu') {
      game.time += dt;
      game.updateMenuScene(dt);
      shot.update?.(ctx);
    } else {
      shot.update?.(ctx);
      if (shot.levelUpdate !== false) game.level.update(dt);
      shot.after?.(ctx);
      if (shot.hud) {
        game.ui.showHud(true);
        const prev = game.state;
        game.state = 'playing';
        game.updateHud();
        game.updateScan(dt);
        game.state = prev;
      }
    }
    game.time += dt;
    game.fxState.letterbox = 1;
    game.updateFx(dt);
    game.engine.fx.uLetterbox.value = 0.1;
    game.engine.fx.uFade.value = fadeAt(t);
    this.overlay.update(t);
    game.audio.updateListener(game.camera);
    game.engine.render();
    game.input.endFrame();
    return true;
  }
}

function makeContext(game, shot) {
  const player = game.player;
  const ctx = {
    game,
    player,
    level: game.level,
    camera: game.camera,
    t: 0, k: 0, dt: 1 / FPS,
    // Place the camera; `shake` adds handheld noise.
    cam(pos, look, fov = 50, shake = 0) {
      game.camera.position.copy(pos);
      if (shake > 0) {
        const g = ctx.global * 1.0;
        game.camera.position.x += (Math.sin(g * 37.1) + Math.sin(g * 23.3)) * 0.5 * shake;
        game.camera.position.y += (Math.sin(g * 41.7) + Math.sin(g * 19.1)) * 0.5 * shake;
      }
      game.camera.lookAt(look);
      if (game.camera.fov !== fov) {
        game.camera.fov = fov;
        game.camera.updateProjectionMatrix();
      }
    },
    // Puppet SPARK: place the robot and animate its rig.
    robot({ pos, yaw = 0, pitch = 0, speed = 0, crouch = false, grounded = true, thrust = 0, light = true, visible = true }) {
      player.body.position.copy(pos);
      player.yaw = yaw;
      player.pitch = pitch;
      player.crouching = crouch;
      player.body.height = crouch ? player.body.crouchHeight : player.body.standHeight;
      player.robot.visible = visible;
      player.viewArms.visible = false;
      player.robot.position.copy(pos);
      player.robot.rotation.y = yaw;
      player.rig.update(ctx.dt, { speed, distance: speed * ctx.dt, pitch, grounded, crouch, thrust, hurt: 0, lowPower: false });
      player.flashlightOn = light;
      player.battery = 100;
      player.updateFlashlight(ctx.dt);
    },
    firstPerson({ pos, yaw, pitch, speed = 0 }) {
      player.body.position.copy(pos);
      player.yaw = yaw;
      player.pitch = pitch;
      player.setViewMode('first', true);
      player.robot.visible = false;
      player.viewArms.visible = true;
      player.flashlightOn = true;
      player.battery = 100;
      player.body.grounded = true;
      player.updateCamera(ctx.dt, speed, false);
      player.updateFlashlight(ctx.dt);
      if (game.camera.fov !== 72) {
        game.camera.fov = 72;
        game.camera.updateProjectionMatrix();
      }
    },
    once(key, fn) {
      if (!ctx[`_${key}`]) {
        ctx[`_${key}`] = true;
        fn();
      }
    }
  };
  player.setViewMode('third', true);
  return ctx;
}

const lerp = THREE.MathUtils.lerp;
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, k) => _v.copy(a).lerp(b, k).clone();
// Height of SPARK's vault over the fallen girders in the meltdown corridor.
const hopY = (z) => [-12, -24, -33].reduce((h, gz) => {
  const d = Math.abs(z - gz) / 1.6;
  return d < 1 ? Math.max(h, 1.15 * (1 - d * d)) : h;
}, 0);

// Fades to/from black (0 = clear, 1 = black).
function fadeAt(t) {
  if (t < 2.5) return 1 - t / 2.5;
  if (t > 13.0 && t < 13.5) return (t - 13.0) / 0.5;
  if (t >= 13.5 && t < 14.2) return 1 - (t - 13.5) / 0.7;
  if (t > 92.7 && t < 93.0) return (t - 92.7) / 0.3;
  if (t >= 93.0 && t < 93.6) return 1 - (t - 93.0) / 0.6;
  if (t > 107.5) return Math.min(1, (t - 107.5) / 2.3);
  return 0;
}

// ---------------------------------------------------------------------------
// Shot list (seconds). Levels: 0 Corridors, 1 Control Room, 2 Meltdown.
// ---------------------------------------------------------------------------
function buildShotList() {
  const shots = [];
  const add = (start, end, def) => shots.push({ start, end, ...def });

  // 0 — Cold open: the core, pushing in.
  add(0, 8.5, {
    level: 2,
    levelTime: 150,
    setup(c) { c.level.timeLeft = 12; c.level.fireActive = false; },
    update(c) {
      c.robot({ pos: V(0, 0, -60), visible: false, light: false });
      const k = ease(c.k);
      c.cam(lerpV(V(-1.5, 2.2, -97.5), V(0.5, 4.2, -104.5), k), V(0, 6.3, -113), 42);
    }
  });

  // 1 — Dark empty corridor, slow dolly; steam vents breathing.
  add(8.5, 13.5, {
    level: 0,
    levelTime: 1.2,
    update(c) {
      c.robot({ pos: V(0, 0, 40), visible: false, light: false });
      c.cam(lerpV(V(0.6, 0.8, -29), V(0.2, 1.0, -23), c.k), V(-0.3, 1.2, -8), 55);
    }
  });

  // 2 — SPARK boots up in the dock.
  add(13.5, 21, {
    level: 0,
    setup(c) { c.visor = c.player.rig.visorMaterials; },
    update(c) {
      const on = THREE.MathUtils.clamp((c.t - 0.6) / 0.5, 0, 1);
      for (const m of c.visor) m.emissiveIntensity = 3.2 * (on > 0 ? on * (0.7 + 0.3 * Math.sin(c.t * 40)) : 0.02);
      const pitch = lerp(-0.45, 0.05, ease(THREE.MathUtils.clamp((c.t - 0.6) / 1.4, 0, 1)));
      const yaw = c.t > 3.5 ? lerp(0, 0.35, ease(Math.min(1, (c.t - 3.5) / 2))) : 0;
      c.robot({ pos: V(0, 0, 3.4), yaw, pitch, light: c.t > 1.0 });
      const k = ease(c.k);
      c.cam(lerpV(V(0.25, 0.95, 2.35), V(1.9, 1.45, 0.4), k), lerpV(V(0, 1.0, 3.4), V(0, 0.85, 3.4), k), lerp(32, 45, k));
    },
    after(c) { if (c.t > 7) for (const m of c.visor) m.emissiveIntensity = 3.2; }
  });

  // 3 — Title over the menu set.
  add(21, 25, { level: 'menu' });

  // 4 — Third-person: walking into the dark.
  add(25, 29, {
    level: 0,
    levelTime: 0.4,
    update(c) {
      const z = 1 - c.t * 2.4;
      c.robot({ pos: V(0, 0, z), yaw: 0, pitch: -0.05, speed: 2.4 });
      c.cam(V(0.75, 1.55, z + 2.7), V(0, 1.0, z - 4), 55, 0.01);
    }
  });

  // 5 — The vents burst just ahead, SPARK waits, then slips through.
  add(29, 32, {
    level: 0,
    levelTime: 2.1,
    update(c) {
      const go = Math.max(0, c.t - 1.6);
      const z = -7.6 - go * 3.8;
      c.robot({ pos: V(-0.3, 0, z), yaw: 0, pitch: 0.1, speed: go > 0 ? 3.8 : 0 });
      c.cam(V(1.75, 0.55, -6.2), V(-0.6, 1.2, -11.5), 50, 0.012);
    }
  });

  // 6 — First person: the flashlight finds Mira's UV ink.
  add(32, 36.3, {
    level: 0,
    hud: true,
    update(c) {
      const k = ease(Math.min(1, c.t / 3.2));
      c.firstPerson({ pos: V(-20.5, 0, -23.2), yaw: lerp(0.75, 0.02, k), pitch: lerp(0.15, 0.38, k) });
    }
  });

  // 7a — Keycard pickup close-up.
  add(36.3, 38.3, {
    level: 0,
    update(c) {
      c.robot({ pos: V(-18, 0, -18.1), yaw: 0, pitch: -0.35 });
      if (c.t > 0.8) c.once('collect', () => c.level.keycards[0].collect());
      c.cam(V(-16.1, 1.55, -20.7), V(-18, 1.15, -18.9), 50);
    }
  });

  // 7b — Scanner ping through the walls.
  add(38.3, 40.5, {
    level: 0,
    hud: true,
    update(c) {
      c.robot({ pos: V(0, 0, -21), yaw: 0.2, pitch: 0.05 });
      if (c.t > 0.25) c.once('scan', () => c.game.triggerScan());
      c.cam(V(0.9, 1.5, -18.3), V(-0.5, 1.0, -26), 55);
    }
  });

  // 8 — Control room crane reveal up to the nebula dome.
  add(40.5, 46, {
    level: 1,
    update(c) {
      c.robot({ pos: V(0, 0, 9.6), yaw: 0, pitch: 0.25, light: false });
      const k = ease(c.k);
      c.cam(lerpV(V(0.4, 0.35, 11.4), V(0.5, 8.0, 10.6), k), lerpV(V(0, 1.3, 6), V(0, 7.5, -8), k), 55);
    },
    setup(c) { c.level.beamAngle = Math.PI * 0.2; }
  });

  // 9 — Hiding behind a pillar while the sentry beam sweeps past.
  add(46, 51, {
    level: 1,
    setup(c) { c.level.beamAngle = Math.PI / 3 - 1.25; },
    update(c) {
      const a = Math.PI / 3;
      const hide = V(Math.cos(a) * 8.35, 0, Math.sin(a) * 8.35);
      const run = Math.max(0, c.t - 3.4);
      const pos = run > 0 ? lerpV(hide, V(8.2, 0, 3.6), Math.min(1, run / 1.3)) : hide;
      const yaw = run > 0 ? -2.2 : Math.atan2(hide.x, hide.z);
      c.robot({ pos, yaw, pitch: 0, crouch: run === 0, speed: run > 0 ? 4.5 : 0, light: false });
      c.cam(V(6.4, 0.75, 10.4), V(2.6, 1.0, 4.4), 48, 0.008);
    }
  });

  // 10 — A junction comes online; energy races along the floor cable.
  add(51, 54, {
    level: 1,
    setup(c) {
      c.j = [...c.level.junctions].filter((j) => j.group.position.y < 1).sort((a, b) => a.load - b.load)[0];
      c.level.progress = c.j.rank;
      c.front = new THREE.Vector3(0, 0, -1).applyQuaternion(c.j.group.quaternion);
      c.side = new THREE.Vector3(-c.front.z, 0, c.front.x);
    },
    update(c) {
      const jp = c.j.group.position;
      const stand = jp.clone().addScaledVector(c.front, 0.95);
      c.robot({ pos: stand, yaw: Math.atan2(c.front.x, c.front.z), pitch: 0.1, light: false });
      if (c.t > 0.7) c.once('on', () => c.level.activateJunction(c.j));
      const k = ease(Math.min(1, Math.max(0, (c.t - 1.1) / 1.8)));
      const camPos = jp.clone().addScaledVector(c.front, 2.3).addScaledVector(c.side, 1.4).setY(1.45);
      const look = lerpV(jp.clone().setY(1.25), jp.clone().addScaledVector(c.front, 5).setY(0.1), k);
      c.cam(camPos, look, 45);
    }
  });

  // 11 — Jump pad launch to the upper ring.
  add(54, 57, {
    level: 1,
    setup(c) {
      c.pad = c.level.jumpPads[1];
      c.body = c.player.body;
      c.body.position.copy(c.pad.pos);
      c.body.velocity.set(0, 0, 0);
    },
    update(c) {
      const b = c.body;
      if (c.t > 0.55) c.once('launch', () => {
        b.velocity.set(c.pad.dir.x * 4.6, 13.6, c.pad.dir.z * 4.6);
        c.thrust = 1.3;
      });
      if (c.t > 0.55) b.step(c.dt);
      c.thrust = Math.max(0, (c.thrust ?? 0) - c.dt * 1.2);
      const yaw = Math.atan2(-c.pad.dir.x, -c.pad.dir.z) + Math.PI;
      c.robot({ pos: b.position.clone(), yaw, pitch: 0.2, grounded: b.grounded || c.t <= 0.55, thrust: c.thrust, light: false });
      c.cam(V(c.pad.pos.x - 2.4, 0.35, c.pad.pos.z - 2.6), _look.copy(b.position).add(V(0, 0.7, 0)), 55);
    }
  });

  // 12 — Meltdown: running toward camera, fire behind, debris falling.
  add(57, 62.8, {
    level: 2,
    setup(c) { c.level.fireDelay = 0; },
    update(c) {
      const z = -6 - c.t * 3.0;
      const y = hopY(z);
      c.robot({ pos: V(0.2 * Math.sin(c.t), y, z), yaw: 0, pitch: 0, speed: 3.0, grounded: y < 0.05, thrust: y > 0.05 ? 0.7 : 0, light: false });
      c.cam(V(0.9, 1.25, z - 4.6), V(0, 1.0, z + 1), 50, 0.03);
      if (c.t > 1.4) c.once('debris', () => dropDebris(c.level, 1.4, z - 6));
      if (c.t > 3.2) c.once('debris2', () => dropDebris(c.level, -1.3, z - 6.5));
    },
    after(c) { c.level.fireZ = c.player.position.z + 10 - c.t * 0.6; c.level.fire.position.z = c.level.fireZ; tameFire(c.level); }
  });

  // 13 — "Run." Low tracking shot, sprinting, fire on its heels.
  add(62.8, 67, {
    level: 2,
    levelTime: 20,
    update(c) {
      const z = -20 - c.t * 4.5;
      const y = hopY(z);
      c.robot({ pos: V(-0.4, y, z), yaw: 0, pitch: -0.05, speed: 6.5, grounded: y < 0.05, thrust: y > 0.05 ? 0.8 : 0 });
      c.cam(V(2.1, 1.15, z + 1.6), V(-0.4, 0.9 + y * 0.5, z - 1.2), 62, 0.05);
    },
    after(c) { c.level.fireZ = c.player.position.z + 4.2; c.level.fire.position.z = c.level.fireZ; tameFire(c.level, 0.6); }
  });

  // 14 — Molten pit: thruster double-jump to the high platform.
  add(67, 72, {
    level: 2,
    levelTime: 3.888 - 1.3,
    setup(c) { c.body = c.player.body; c.level.fireActive = false; c.level.fire.visible = false; },
    update(c) {
      const b = c.body;
      const mp = c.level.movingPlatform;
      if (c.t < 1.9) {
        b.position.set(mp.x, 0.8, -53.6);
        b.velocity.set(0, 0, 0);
      } else {
        c.once('jump', () => { b.velocity.set(0, 8.2, -5.6); c.thrust = 0.6; });
        if (c.t > 2.25) c.once('boost', () => { b.velocity.y = 8.0; c.thrust = 1.4; });
        if (!b.grounded || b.velocity.y > 0) { b.velocity.z = -5.6; b.velocity.x = 0; }
        else { b.velocity.z = 0; }
        b.step(c.dt);
      }
      c.thrust = Math.max(0, (c.thrust ?? 0) - c.dt * 1.4);
      c.robot({ pos: b.position.clone(), yaw: 0, pitch: 0.1, grounded: c.t < 1.9 || b.grounded, thrust: c.thrust, speed: c.t < 1.9 ? 0 : 3 });
      c.cam(V(2.3, 3.3, -50.2 - c.k * 1.5), V(-0.3, 1.4, -57.2), 55, 0.01);
    }
  });

  // 15 — Pistons: wait, dash, made it.
  add(72, 76, {
    level: 2,
    levelTime: 0.4,
    setup(c) { c.level.fireActive = false; c.level.fire.visible = false; },
    update(c) {
      const run = THREE.MathUtils.clamp((c.t - 1.95) / 0.75, 0, 1);
      const z = lerp(-78.3, -83.25, run);
      c.robot({ pos: V(-0.2, 0, z), yaw: 0, pitch: 0.05, speed: run > 0 && run < 1 ? 6.6 : 0 });
      c.cam(V(2.4, 5.1, -76.7), V(-0.6, 0.2, -82.6), 58, 0.015);
    }
  });

  // 16a — Bringing a stabiliser pylon online.
  add(76, 79.3, {
    level: 2,
    setup(c) { c.level.fireActive = false; c.level.fire.visible = false; },
    update(c) {
      const py = c.level.pylons[0];
      c.robot({ pos: V(-9.9, 1.2, -113), yaw: Math.PI / 2, pitch: 0.2, light: false });
      if (c.t > 1.3) c.once('pylon', () => c.level.activatePylon(py));
      const k = ease(c.k);
      c.cam(lerpV(V(-6.2, 2.0, -110.3), V(-6.8, 2.8, -111.4), k), V(-10.6, 1.9, -113), 48);
    }
  });

  // 16b — Wide: plasma flare erupts behind SPARK.
  add(79.3, 83, {
    level: 2,
    setup(c) {
      c.level.fireActive = false; c.level.fire.visible = false;
      c.level.activatePylon(c.level.pylons[0]);
      c.level.activatePylon(c.level.pylons[1]);
      c.level.flareTimer = 99;
    },
    update(c) {
      const x = lerp(-7, 1.5, c.k);
      c.robot({ pos: V(x, 0, -104.5), yaw: -Math.PI / 2, pitch: 0, speed: 5 });
      if (c.t > 0.3) c.once('flare', () => fireFlare(c.level, V(x - 2.2, 0, -104.5)));
      c.cam(V(8, 6.2, -102), V(-1.5, 3.2, -110), 52, 0.01);
    },
    after(c) { c.level.flareTimer = 99; }
  });

  // 17 — Montage: eight quick cuts.
  const cut = 10 / 8;
  const m = (i) => 83 + i * cut;
  add(m(0), m(1), {
    level: 1,
    setup(c) { c.level.beamAngle = Math.PI * 0.62; },
    update(c) {
      c.robot({ pos: V(0, 0, 40), visible: false, light: false });
      c.cam(V(-7.5, 6.5, 9.5), V(0, 0.5, 0.5), 50);
    },
    after(c) { c.level.scannerMat.uniforms.uAlert.value = 0.85; }
  });
  add(m(1), m(2), {
    level: 0,
    update(c) { c.firstPerson({ pos: V(-20.5, 0, -24.0), yaw: lerp(0.3, -0.05, c.k), pitch: 0.36 }); }
  });
  add(m(2), m(3), {
    level: 1,
    update(c) {
      c.robot({ pos: V(0, 0, 40), visible: false, light: false });
      c.cam(V(-3, 1.2, 9), V(2, 12, -6), 70);
    }
  });
  add(m(3), m(4), {
    level: 2,
    levelTime: 160,
    setup(c) { c.level.fireActive = false; c.level.fire.visible = false; c.level.timeLeft = 20; },
    update(c) {
      c.robot({ pos: V(0, 0, -60), visible: false, light: false });
      c.cam(lerpV(V(-3.4, 6.8, -106.4), V(-2.9, 6.7, -106.8), c.k), V(0, 6.5, -113), 38);
    }
  });
  add(m(4), m(5), {
    level: 0,
    levelTime: 1.5,
    update(c) {
      c.robot({ pos: V(0, 0, 40), visible: false, light: false });
      c.cam(V(-14.8, 0.5, -38.4), V(-26, 1.4, -38), 50);
    }
  });
  add(m(5), m(6), {
    level: 2,
    update(c) {
      const z = -30 - c.t * 6;
      c.robot({ pos: V(0, 0, z), yaw: 0, speed: 6, visible: true, light: false });
      c.cam(V(-1.8, 1.8, z - 5), V(0, 1.6, z + 3), 55, 0.04);
    },
    after(c) { c.level.fireZ = c.player.position.z + 4.5; c.level.fire.position.z = c.level.fireZ; tameFire(c.level); }
  });
  add(m(6), m(7), {
    level: 1,
    setup(c) {
      c.game.ui.showRoutingGrid(() => {}, () => {});
    },
    update(c) {
      c.robot({ pos: V(0, 0, -9.0), yaw: 0, light: false });
      c.cam(V(0.5, 1.6, -7.6), V(0, 1.5, -11), 55);
    }
  });
  add(m(7), 93, {
    level: 2,
    levelTime: 3.888,
    setup(c) { c.body = c.player.body; c.body.position.set(0, 0.8, -53.6); c.body.velocity.set(0, 8.2, -5.6); c.level.fireActive = false; c.level.fire.visible = false; },
    update(c) {
      const b = c.body;
      if (c.t > 0.3) c.once('boost', () => { b.velocity.y = 8.0; });
      b.velocity.z = -5.6;
      b.step(c.dt);
      c.robot({ pos: b.position.clone(), yaw: 0, pitch: 0.1, grounded: false, thrust: 1.2 });
      c.cam(V(-3.8, 0.5, -57), _look.copy(b.position).add(V(0, 0.6, 0)), 60);
    }
  });

  // 18 — The seal: the core cools from orange to blue.
  add(93, 99.5, {
    level: 2,
    setup(c) {
      const L = c.level;
      L.fireActive = false; L.fire.visible = false;
      L.inChamber = true;
      L.flareTimer = 999;
      for (const p of L.pylons) if (!p.online) L.activatePylon(p);
      L.bridge.extend = 1;
      L.bridge.mesh.scale.z = 1;
      L.bridge.mesh.position.z = -113 + 2 + 2.05;
    },
    update(c) {
      c.robot({ pos: V(0, 0, -110.75), yaw: 0, pitch: 0.35, light: false });
      if (c.t > 0.5) c.once('seal', () => { c.level.sealCore(); c.level.timers = []; });
      const k = ease(c.k);
      c.cam(lerpV(V(0.75, 1.55, -108.6), V(7.5, 6.5, -99.5), k), lerpV(V(0, 2.4, -112), V(0, 5.8, -113), k), lerp(45, 55, k));
    },
    after(c) { c.level.flareTimer = 999; }
  });

  // 19 — End card over the cooled, orbiting core.
  add(99.5, DURATION + 1, {
    level: 2,
    setup(c) {
      const L = c.level;
      L.fireActive = false; L.fire.visible = false;
      L.inChamber = true; L.flareTimer = 999;
      for (const p of L.pylons) if (!p.online) L.activatePylon(p);
      L.sealed = true; L.sealTime = 10; L.timers = [];
    },
    update(c) {
      c.robot({ pos: V(0, 0, -110.75), yaw: 0, pitch: 0.3, light: false });
      const a = 0.4 + c.t * 0.05;
      c.cam(V(Math.sin(a) * 13, 4.5, -113 + Math.cos(a) * 13), V(0, 6.2, -113), 50);
    },
    after(c) { c.level.flareTimer = 999; }
  });

  return shots;
}

// Keep the fire readable on camera when SPARK is silhouetted against it.
function tameFire(level, k = 0.42) {
  level.fireMat.uniforms.uIntensity.value = k;
  level.fireLight.intensity = 22;
}

// Level 3 helpers: drop a debris chunk / fire a plasma flare on cue.
function dropDebris(level, x, z) {
  const d = level.debris.find((k) => k.state === 'idle');
  if (!d) return;
  d.state = 'warn';
  d.t = 0;
  d.target = new THREE.Vector3(x, 0, z);
  d.warn.position.set(x, 0.03, z);
  d.warn.visible = true;
  d.mesh.visible = false;
}

function fireFlare(level, pos) {
  const f = level.flares.find((k) => k.state === 'idle');
  if (!f) return;
  f.state = 'warn';
  f.t = 0.3;
  f.pos.copy(pos);
  f.warn.position.set(pos.x, pos.y + 0.04, pos.z);
  f.warn.visible = true;
}

// ---------------------------------------------------------------------------
// Overlays: title cards and captions, animated from the trailer clock.
// ---------------------------------------------------------------------------
function buildOverlay() {
  const root = document.createElement('div');
  root.id = 'trailer-overlay';
  root.innerHTML = `
  <style>
    #trailer-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 100; font-family: Orbitron, sans-serif; color: #e8f6ff; }
    #trailer-overlay .item { position: absolute; opacity: 0; will-change: opacity, transform; }
    .t-sys { left: 7%; top: 16%; font-size: 22px; letter-spacing: .28em; color: #ff8a3a; text-shadow: 0 0 14px rgba(255,106,32,.7); }
    .t-sys small { display:block; font-size: 15px; color: #9fb7c8; letter-spacing: .4em; margin-top: 8px; text-shadow:none; }
    .t-title { left: 0; right: 0; top: 34%; text-align: center; }
    .t-title .a { font-weight: 900; font-size: 150px; letter-spacing: .14em; line-height: .95; color: #fff; text-shadow: 0 0 40px rgba(55,200,255,.7); }
    .t-title .b { font-weight: 900; font-size: 150px; letter-spacing: .14em; line-height: .95; background: linear-gradient(90deg,#ffb020,#ff4a1a); -webkit-background-clip: text; background-clip:text; color: transparent; filter: drop-shadow(0 0 26px rgba(255,106,32,.8)); }
    .t-title .c { margin-top: 26px; font-size: 22px; letter-spacing: .9em; color: #ffb020; }
    .t-chapter { left: 6%; bottom: 17%; }
    .t-chapter .n { font-size: 20px; letter-spacing: .6em; color: #ffb020; }
    .t-chapter .name { font-size: 76px; font-weight: 900; letter-spacing: .12em; text-shadow: 0 0 30px rgba(55,200,255,.6); }
    .t-chapter .verb { font-size: 24px; letter-spacing: 1.1em; color: #37c8ff; margin-top: 6px; }
    .t-cap { left: 0; right: 0; bottom: 16%; text-align: center; font-size: 36px; font-weight: 700; letter-spacing: .3em; text-shadow: 0 0 24px rgba(55,200,255,.8), 0 2px 8px #000; }
    .t-word { left: 0; right: 0; top: 40%; text-align: center; font-size: 120px; font-weight: 900; letter-spacing: .3em; color: #fff; text-shadow: 0 0 50px rgba(255,70,26,.9); }
    .t-end { left: 0; right: 0; top: 0; bottom: 0; padding-top: 12%; text-align: center; background: radial-gradient(ellipse 55% 50% at 50% 48%, rgba(2,6,12,.78), rgba(2,6,12,.35) 60%, rgba(2,6,12,0) 85%); }
    .t-end .a { font-weight: 900; font-size: 128px; letter-spacing: .14em; color: #fff; text-shadow: 0 0 40px rgba(55,200,255,.8); }
    .t-end .b { font-weight: 900; font-size: 128px; letter-spacing: .14em; background: linear-gradient(90deg,#ffb020,#ff4a1a); -webkit-background-clip:text; background-clip:text; color: transparent; filter: drop-shadow(0 0 22px rgba(255,106,32,.8)); line-height:.95; }
    .t-end .tag { margin-top: 30px; font-family: Rajdhani, sans-serif; font-weight: 600; font-size: 34px; letter-spacing: .12em; color: #cfe6f5; }
    .t-end .cta { display:inline-block; margin-top: 34px; padding: 16px 40px; border: 2px solid #ffb020; font-size: 26px; letter-spacing: .4em; color: #ffb020; box-shadow: 0 0 30px rgba(255,176,32,.35); }
    .t-end .small { margin-top: 30px; font-family: Rajdhani, sans-serif; font-size: 22px; letter-spacing: .2em; color: #8aa4b8; }
    .t-flash { inset: 0; background: #fff; }
  </style>`;
  document.body.appendChild(root);
  const items = [];
  const add = (start, end, cls, html, { fadeIn = 0.5, fadeOut = 0.5, zoom = 0, rise = 0, type = false } = {}) => {
    const el = document.createElement('div');
    el.className = `item ${cls}`;
    el.innerHTML = html;
    root.appendChild(el);
    items.push({ start, end, el, fadeIn, fadeOut, zoom, rise, type, text: type ? el.textContent : null });
  };

  add(1.4, 5.4, 't-sys', 'HELIOS-9 · REACTOR CORE · 3,410 K ▲<small>CONTAINMENT FIELD FAILING</small>', { fadeIn: 0.2, fadeOut: 0.6 });
  add(5.7, 8.3, 't-sys', 'CREW STATUS: EVACUATED<small>MAINTENANCE UNIT SPARK-07 · STANDBY</small>', { fadeIn: 0.2, fadeOut: 0.5 });
  add(20.95, 21.35, 't-flash', '', { fadeIn: 0.0, fadeOut: 0.4 });
  add(21.0, 25.0, 't-title', '<div class="a">CORE</div><div class="b">BREACH</div><div class="c">REACTOR PROTOCOL</div>', { fadeIn: 0.15, fadeOut: 0.5, zoom: 0.06 });
  add(25.4, 28.6, 't-chapter', '<div class="n">LEVEL 01</div><div class="name">CORRIDORS</div><div class="verb">EXPLORE</div>', { rise: 30 });
  add(40.5, 43.8, 't-chapter', '<div class="n">LEVEL 02</div><div class="name">CONTROL ROOM</div><div class="verb">SOLVE</div>', { rise: 30 });
  add(56.95, 57.3, 't-flash', '', { fadeIn: 0.0, fadeOut: 0.35 });
  add(57.0, 60.2, 't-chapter', '<div class="n">LEVEL 03</div><div class="name">MELTDOWN</div><div class="verb">ESCAPE</div>', { rise: 30 });
  add(62.75, 64.3, 't-word', 'RUN.', { fadeIn: 0.05, fadeOut: 0.5, zoom: 0.15 });
  add(83.0, 86.6, 't-cap', 'REAL-TIME LIGHT & SHADOW', { fadeIn: 0.25, fadeOut: 0.3 });
  add(86.8, 89.6, 't-cap', 'PUZZLES · STEALTH · PLATFORMING', { fadeIn: 0.25, fadeOut: 0.3 });
  add(89.8, 92.7, 't-cap', '3 LEVELS · EXPLORE · SOLVE · ESCAPE', { fadeIn: 0.25, fadeOut: 0.3 });
  add(99.4, 99.8, 't-flash', '', { fadeIn: 0.0, fadeOut: 0.4 });
  add(99.5, DURATION + 1, 't-end', `
      <div class="a">CORE</div><div class="b">BREACH</div>
      <div class="tag">One robot. One reactor. No second chances.</div>
      <div class="cta">PLAY FREE IN YOUR BROWSER</div>
      <div class="small">A COMS3006A PROJECT · UNIVERSITY OF THE WITWATERSRAND</div>`, { fadeIn: 1.2, fadeOut: 0.01, zoom: 0.03 });

  return {
    update(t) {
      for (const it of items) {
        let o = 0;
        if (t >= it.start && t < it.end) {
          const a = it.fadeIn > 0 ? Math.min(1, (t - it.start) / it.fadeIn) : 1;
          const b = it.fadeOut > 0 ? Math.min(1, (it.end - t) / it.fadeOut) : 1;
          o = Math.min(a, b);
        }
        it.el.style.opacity = o;
        if (o > 0) {
          const p = (t - it.start) / (it.end - it.start);
          const s = 1 + it.zoom * p;
          const y = it.rise * (1 - Math.min(1, (t - it.start) / 0.6));
          it.el.style.transform = `translateY(${y}px) scale(${s})`;
        }
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Soundtrack: score + sound design rendered offline with the game's synth.
// ---------------------------------------------------------------------------
let rendered = null;

async function renderSoundtrack() {
  const rate = 48000;
  const ctx = new OfflineAudioContext(2, rate * DURATION, rate);
  const a = new AudioEngine();
  a.setupGraph(ctx);
  a.master.gain.value = 0.9;
  a.musicBus.gain.value = 0.62;
  a.sfxBus.gain.value = 0.85;

  // Music cues: [track, start, end, intensity(t), fadeIn, fadeOut]
  const ramp = (t0, t1, v0, v1) => (t) => v0 + (v1 - v0) * Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  a.scheduleSegment('level1', 0.0, 13.6, ramp(0, 13, 0.0, 0.3), 2.0, 0.6);
  a.scheduleSegment('level1', 13.6, 21.0, ramp(13.6, 20, 0.45, 1.0), 0.4, 0.15);
  a.scheduleSegment('menu', 21.0, 25.4, () => 0, 0.05, 0.6);
  a.scheduleSegment('level1', 25.0, 40.6, ramp(25, 40, 0.3, 0.75), 0.4, 0.3);
  a.scheduleSegment('level2', 40.5, 57.0, ramp(40.5, 56, 0.2, 1.0), 0.1, 0.12);
  a.scheduleSegment('level3', 57.0, 92.9, ramp(57, 66, 0.7, 1.0), 0.05, 0.25);
  a.scheduleSegment('victory', 96.0, DURATION, () => 0, 2.5, 4.0);

  // Sound design cues: [name, time, volume]
  const fx = [
    ['rumble', 0.2, 0.9], ['alarm', 1.3, 0.35], ['rumble', 4.5, 0.6], ['alarm', 5.6, 0.25],
    ['steam', 10.2, 0.5],
    ['reboot', 13.9, 1.0], ['flashlight', 14.5, 1.0], ['servo', 15.2, 0.8], ['servo', 17.2, 0.6],
    ['seal', 18.0, 0.55],
    ['crash', 21.0, 1.0], ['rumble', 21.0, 1.0],
    ['steamWarn', 29.0, 0.9], ['steam', 29.3, 1.0],
    ['success', 34.6, 0.6],
    ['keycard', 37.1, 1.0], ['scan', 38.6, 1.0],
    ['crash', 40.5, 0.6], ['door', 40.6, 0.5],
    ['zap', 48.4, 0.4], ['alarm', 48.5, 0.25],
    ['junction', 51.75, 1.0], ['servo', 51.6, 0.6],
    ['boost', 54.6, 1.0], ['land', 55.7, 0.8],
    ['crash', 57.0, 1.0], ['rumble', 57.0, 1.0], ['alarm', 57.3, 0.5],
    ['crash', 59.1, 0.9], ['crash', 60.9, 0.8],
    ['boost', 62.8, 0.6], ['rumble', 63.0, 0.8],
    ['jump', 68.9, 0.8], ['boost', 69.3, 1.0], ['land', 70.0, 0.8],
    ['piston', 72.6, 1.0], ['piston', 74.75, 1.0],
    ['junction', 77.3, 1.0], ['surge', 80.7, 1.0], ['crash', 80.9, 0.6],
    ['zap', 83.0, 0.4], ['success', 84.25, 0.4], ['crash', 85.5, 0.5], ['seal', 86.0, 0.2],
    ['steam', 88.0, 0.6], ['crash', 89.25, 0.6], ['tile', 90.5, 1.0], ['tile', 90.9, 1.0], ['boost', 91.8, 1.0],
    ['seal', 93.5, 1.0],
    ['crash', 99.5, 0.7]
  ];
  for (const [name, at, volume] of fx) a.play(name, { at, volume, reverb: 0.3 });

  const buffer = await ctx.startRendering();
  // Interleave to 16-bit PCM WAV.
  const L = buffer.getChannelData(0), R = buffer.getChannelData(1);
  const n = L.length;
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  rendered = new Uint8Array(out.buffer);
  return rendered.length;
}

function audioChunk(i, size) {
  const slice = rendered.subarray(i * size, (i + 1) * size);
  let s = '';
  for (let k = 0; k < slice.length; k += 0x8000) s += String.fromCharCode.apply(null, slice.subarray(k, k + 0x8000));
  return btoa(s);
}
