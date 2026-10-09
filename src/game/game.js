// The game: state machine, level management, interaction, minimap, hints,
// post-processing state and the menu backdrop.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PhysicsWorld } from '../engine/physics.js';
import { audio } from '../engine/audio.js';
import { settings, progress } from '../engine/settings.js';
import { textures } from '../engine/textures.js';
import { Player } from './player.js';
import { buildProceduralRobot, RobotRig, loadRobotModel } from './robot.js';
import { Level1 } from './levels/level1.js';
import { Level2 } from './levels/level2.js';
import { Level3 } from './levels/level3.js';
import { createReactorCoreMaterial, createCoronaMaterial } from '../shaders/reactorCore.js';
import { createScanPulseMaterial } from '../shaders/effects.js';
import { fmtTime } from '../ui/ui.js';

export const LEVELS = [Level1, Level2, Level3];
export const LEVEL_FX = [
  { tint: [0.92, 1.0, 1.1], bloom: 0.8, vignette: 0.7, exposure: 1.15 },
  { tint: [1.0, 1.0, 1.04], bloom: 0.55, vignette: 0.55, exposure: 0.85 },
  { tint: [1.12, 0.96, 0.86], bloom: 0.85, vignette: 0.6, exposure: 1.0 }
];
const MINIMAP_SIZES = [190, 320, 0];

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function newStats() {
  return { time: 0, deaths: 0, damageTaken: 0, hintsUsed: 0, logs: 0, secrets: 0, mistakes: 0, detections: 0, boosts: 0, falls: 0 };
}

export class Game {
  constructor({ engine, ui, input }) {
    this.engine = engine;
    this.ui = ui;
    this.input = input;
    this.audio = audio;
    this.state = 'loading';
    this.physics = new PhysicsWorld();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.get('fov'), window.innerWidth / window.innerHeight, 0.05, 400);
    this.scene.add(this.camera);
    this.level = null;
    this.levelIndex = 0;
    this.stats = newStats();
    this.runStats = [];
    this.fxState = { damage: 0, glitch: 0, fade: 0, letterbox: 0, scan: 0 };
    this.tweens = [];
    this.scanCooldown = 0;
    this.scanTime = 0;
    this.hintKey = null;
    this.hintTier = 0;
    this.minimapMode = 0;
    this.lastProgressTime = 0;
    this.lastObjective = '';
    this.countdownSecond = -1;
    this.heartbeat = 0;
    this.time = 0;
  }

  // ------------------------------------------------------------------ init --
  async init(onProgress) {
    const step = async (fraction, text, fn) => {
      onProgress(fraction, text);
      await new Promise((r) => setTimeout(r, 0));
      fn?.();
    };

    await step(0.1, 'Generating surface textures…', () => {
      textures.panels(); textures.floor(); textures.ceiling();
    });
    await step(0.3, 'Generating hazard & rubble maps…', () => {
      textures.hazard(); textures.rubble(); textures.brushed(); textures.grate(); textures.starCube();
    });
    await step(0.45, 'Building environment lighting…', () => {
      const pmrem = new THREE.PMREMGenerator(this.engine.renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      this.scene.environment = env;
      this.envMap = env;
    });
    await step(0.55, 'Assembling SPARK…', () => {
      this.player = new Player(this, this.camera);
    });
    await step(0.65, 'Loading Blender models…');
    const model = await loadRobotModel();
    if (model) {
      this.player.swapRobotModel(model);
      this.robotTemplate = model;
    }
    await step(0.75, 'Building the tactical map…', () => this.buildMinimapBase());
    await step(0.85, 'Spinning up the reactor…', () => this.buildMenuScene());
    onProgress(0.92, 'Compiling shaders…');
    await this.engine.compile(this.menuScene, this.menuCamera);
    onProgress(1, 'Ready');

    this.bindUi();
    this.engine.onQualityChange = () => {};
    this.input.onLockChange = (locked, error) => this.onLockChange(locked, error);
    this.engine.canvas.addEventListener('click', () => {
      if (this.state === 'playing' && !this.input.locked) this.input.requestLock();
      if (this.state === 'intro') this.skipIntro();
    });
    this.ui.el.resume.addEventListener('click', () => this.input.requestLock());
    this.ui.el.intro.addEventListener('click', () => this.skipIntro());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
  }

  bindUi() {
    const ui = this.ui;
    ui.on('newGame', () => {
      audio.init();
      this.startNewGame();
    });
    ui.on('playLevel', (n) => {
      audio.init();
      ui.closePanel();
      this.stats = newStats();
      this.runStats = [];
      this.runFromLevel = n - 1;
      this.loadLevel(n - 1);
    });
    ui.on('resume', () => this.resume());
    ui.on('restartLevel', () => this.restartLevel());
    ui.on('restartGame', () => this.startNewGame());
    ui.on('retryCheckpoint', () => this.retryCheckpoint());
    ui.on('quitToMenu', () => this.quitToMenu());
    ui.on('continue', () => this.continueAfterResult());
  }

  // ------------------------------------------------------------- menu scene --
  buildMenuScene() {
    const scene = new THREE.Scene();
    scene.background = textures.starCube();
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.4;
    scene.fog = new THREE.FogExp2(0x05070c, 0.008);
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);

    const coreMat = createReactorCoreMaterial();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 24), coreMat);
    core.position.set(0, 3.2, 0);
    const coronaMat = createCoronaMaterial();
    const corona = new THREE.Mesh(new THREE.SphereGeometry(3.7, 48, 24), coronaMat);
    corona.position.copy(core.position);
    scene.add(core, corona);
    const rings = [];
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x4a4446, metalness: 0.9, roughness: 0.3 });
    for (let i = 0; i < 3; i++) {
      const pivot = new THREE.Group();
      pivot.position.copy(core.position);
      pivot.rotation.set(i * 1.1, i * 0.7, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.0 + i * 0.4, 0.1, 10, 96), ringMat);
      pivot.add(ring);
      scene.add(pivot);
      rings.push(pivot);
    }
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ ...textures.set('floor', 10, 10), color: 0x8a8f96, metalness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.08, 8, 96), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xff8a1f, emissiveIntensity: 3 }));
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.02;
    scene.add(lip);
    const light = new THREE.PointLight(0xff6a20, 120, 40, 1.6);
    light.position.copy(core.position);
    scene.add(light);
    const rim = new THREE.SpotLight(0x37c8ff, 120, 30, 0.5, 0.6, 1.4);
    rim.position.set(-6, 8, 8);
    rim.target.position.set(2.2, 0.8, 5.2);
    rim.castShadow = true;
    rim.shadow.mapSize.set(1024, 1024);
    scene.add(rim, rim.target);
    scene.add(new THREE.HemisphereLight(0x4a6a9a, 0x100808, 0.6));

    // SPARK standing in front of the core.
    let robot;
    if (this.robotTemplate) {
      robot = this.robotTemplate.clone(true);
    } else {
      robot = buildProceduralRobot().root;
    }
    robot.position.set(2.2, 0, 5.2);
    robot.rotation.y = -Math.PI * 0.12;
    robot.scale.setScalar(1.6);
    robot.visible = true; // the template may be hidden while the player is in first person
    robot.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(robot);
    const rig = new RobotRig(robot, null);

    this.menuScene = scene;
    this.menuCamera = camera;
    this.menu = { coreMat, coronaMat, rings, rig, core };
  }

  updateMenuScene(dt) {
    const m = this.menu;
    const t = this.time;
    m.coreMat.uniforms.uTime.value = t;
    m.coreMat.uniforms.uInstability.value = 0.55 + Math.sin(t * 0.3) * 0.2;
    m.coronaMat.uniforms.uTime.value = t;
    m.coronaMat.uniforms.uInstability.value = 0.5;
    m.core.rotation.y += dt * 0.2;
    m.rings.forEach((r, i) => {
      r.rotation.x += dt * (0.3 + i * 0.15);
      r.rotation.y += dt * (0.2 + i * 0.1);
    });
    m.rig.update(dt, { speed: 0, distance: 0, pitch: Math.sin(t * 0.5) * 0.2 - 0.25, grounded: true, crouch: false, thrust: 0, hurt: 0, lowPower: false });
    // Slow drift; framed so the core and SPARK sit right of the menu column.
    const a = Math.sin(t * 0.07) * 0.35;
    this.menuCamera.position.set(-2.6 + Math.sin(a) * 4, 2.6 + Math.sin(t * 0.2) * 0.3, 12.5 + Math.cos(a) * 0.5);
    this.menuCamera.lookAt(-3.2, 2.4, 0);
  }

  showMainMenu() {
    this.state = 'menu';
    this.engine.setView(this.menuScene, this.menuCamera);
    this.engine.minimap = null;
    this.engine.setBloom(0.9);
    this.engine.renderer.toneMappingExposure = 1.0;
    const fx = this.engine.fx;
    fx.uTint.value.set(1, 1, 1);
    fx.uHeat.value = 0;
    fx.uVignette.value = 0.6;
    this.fxState.letterbox = 0;
    this.fxState.fade = 0;
    this.ui.showMenu();
    audio.playMusic('menu');
  }

  // -------------------------------------------------------------- minimap --
  buildMinimapBase() {
    this.mapScene = new THREE.Scene();
    this.mapCamera = new THREE.OrthographicCamera(-14, 14, 14, -14, 0.1, 200);
    this.mapCamera.position.set(0, 100, 0);
    this.mapCamera.lookAt(0, 0, 0);
    this.mapLevel = new THREE.Group();
    this.mapScene.add(this.mapLevel);
    // Player arrow.
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.9);
    shape.lineTo(0.6, 0.6);
    shape.lineTo(0, 0.25);
    shape.lineTo(-0.6, 0.6);
    shape.closePath();
    const arrowGeo = new THREE.ShapeGeometry(shape);
    arrowGeo.rotateX(Math.PI / 2);
    this.mapPlayer = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide }));
    this.mapPlayer.position.y = 30;
    this.mapScene.add(this.mapPlayer);
    // View cone.
    const cone = new THREE.Mesh(new THREE.CircleGeometry(6, 24, Math.PI / 2 - 0.45, 0.9), new THREE.MeshBasicMaterial({ color: 0x37c8ff, transparent: true, opacity: 0.15, toneMapped: false, depthWrite: false }));
    cone.rotation.x = -Math.PI / 2;
    cone.position.y = 29;
    this.mapCone = cone;
    this.mapScene.add(cone);
  }

  buildMinimapForLevel(level) {
    // Clear previous.
    this.mapLevel.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.mapLevel.clear();
    const floors = [];
    const walls = [];
    const lows = [];
    for (const c of this.physics.colliders) {
      if (!c.minimap && c.shape !== 'ring') continue;
      if (c.shape === 'ring') {
        const g = new THREE.RingGeometry(c.rInner, c.rOuter, 72, 1);
        g.rotateX(-Math.PI / 2);
        g.translate(c.cx, c.max.y > 2 ? 2 : 0.5, c.cz);
        (c.max.y > 2 && c.min.y < 1 ? walls : c.max.y > 1 ? lows : floors).push(g);
        continue;
      }
      const w = c.max.x - c.min.x, d = c.max.z - c.min.z;
      if (w > 60 || d > 60) continue;
      const g = new THREE.PlaneGeometry(w, d);
      g.rotateX(-Math.PI / 2);
      const top = c.max.y;
      const isFloor = top <= 0.05 && c.min.y < 0;
      g.translate((c.min.x + c.max.x) / 2, isFloor ? 0 : top > 2.5 ? 2 : 1, (c.min.z + c.max.z) / 2);
      (isFloor ? floors : top > 2.5 ? walls : lows).push(g);
    }
    const add = (geos, color, y) => {
      if (!geos.length) return;
      const merged = mergeFlat(geos);
      const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
      mesh.position.y = y;
      this.mapLevel.add(mesh);
    };
    add(walls, 0x0c2433, 0);
    add(floors, 0x1b5674, 0);
    add(lows, 0x5fc4ee, 0);

    // Markers.
    this.mapMarkers = [];
    const geos = {
      dot: new THREE.CircleGeometry(0.55, 16),
      square: new THREE.PlaneGeometry(1.0, 1.0),
      diamond: new THREE.CircleGeometry(0.8, 4),
      hazard: new THREE.CircleGeometry(0.75, 3),
      door: new THREE.PlaneGeometry(2.4, 0.6),
      goal: new THREE.RingGeometry(1.0, 1.5, 24),
      core: new THREE.CircleGeometry(2.6, 32),
      turret: new THREE.RingGeometry(0.7, 1.2, 20),
      fire: new THREE.PlaneGeometry(7, 1.2)
    };
    for (const g of Object.values(geos)) g.rotateX(-Math.PI / 2);
    this.mapMarkerGeos = geos;
    for (const m of level.markers) {
      const mesh = new THREE.Mesh(geos[m.shape] ?? geos.dot, new THREE.MeshBasicMaterial({ color: m.color, toneMapped: false, transparent: true, depthWrite: false }));
      mesh.position.y = 10;
      this.mapLevel.add(mesh);
      this.mapMarkers.push({ def: m, mesh });
    }
  }

  updateMinimap() {
    const size = MINIMAP_SIZES[this.minimapMode];
    const visible = size > 0 && (this.state === 'playing' || this.state === 'modal');
    this.ui.setMinimap(size, visible);
    if (!visible) {
      this.engine.minimap = null;
      return;
    }
    const p = this.player.position;
    const span = this.minimapMode === 1 ? 26 : 16;
    const cam = this.mapCamera;
    cam.left = -span; cam.right = span; cam.top = span; cam.bottom = -span;
    cam.updateProjectionMatrix();
    // Heading-up map: rotate the camera's up vector with the player's yaw.
    cam.position.set(p.x, 100, p.z);
    cam.up.set(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw));
    cam.lookAt(p.x, 0, p.z);
    this.mapPlayer.position.set(p.x, 30, p.z);
    this.mapPlayer.rotation.y = this.player.yaw;
    this.mapCone.position.set(p.x, 29, p.z);
    this.mapCone.rotation.z = this.player.yaw;
    const t = this.time;
    for (const { def, mesh } of this.mapMarkers) {
      const target = def.target.isObject3D ? def.target.getWorldPosition(_v) : def.target;
      mesh.position.set(target.x, 10, target.z);
      mesh.visible = def.visible();
      const pulse = def.pulse?.() ? 1.4 + Math.sin(t * 20) * 0.3 : 1 + Math.sin(t * 4) * 0.1;
      mesh.scale.setScalar(pulse);
      if (def.shape === 'diamond') mesh.rotation.y = t;
    }
    this.engine.minimap = { scene: this.mapScene, camera: cam, visible: true, size };
  }

  // ---------------------------------------------------------------- flow --
  startNewGame() {
    this.stats = newStats();
    this.runStats = [];
    this.runFromLevel = 0;
    this.ui.closePanel();
    this.loadLevel(0);
  }

  async loadLevel(index, { cinematic = true } = {}) {
    if (this.loadingLevel) return;
    this.loadingLevel = true;
    this.input.requestLock();
    this.state = 'loading';
    this.ui.hideAll();
    this.ui.clearSubtitle();
    audio.silenceVoice();
    await this.tween((k) => { this.fxState.fade = Math.max(this.fxState.fade, k); }, 0.35);

    // Tear down the previous level completely.
    if (this.level) {
      this.level.dispose();
      this.level = null;
    }
    audio.stopAllLoops();
    this.physics.clear();
    this.scene.fog = null;

    this.levelIndex = index;
    const LevelClass = LEVELS[index];
    const level = new LevelClass(this);
    this.level = level;
    this.stats = newStats();
    level.build();
    this.scene.add(level.root);
    this.buildMinimapForLevel(level);

    // Reset the player for this level.
    const p = this.player;
    p.abilities.doubleJump = false;
    p.battery = 100;
    p.flashlightOn = index !== 1;
    p.spawn(level.checkpoint.position, level.checkpoint.yaw);
    this.ui.setAbilities(index === 2 ? ['THRUSTERS'] : []);
    this.ui.setKeycards(null);
    this.ui.setLevelTag(LevelClass.meta);

    const fx = LEVEL_FX[index];
    this.engine.fx.uTint.value.set(...fx.tint);
    this.engine.fx.uVignette.value = fx.vignette;
    this.engine.setBloom(fx.bloom);
    this.engine.renderer.toneMappingExposure = fx.exposure;
    this.engine.setView(this.scene, this.camera);

    // Pre-compile every shader for this level so the first frames do not hitch.
    await this.engine.compile(this.scene, this.camera);
    audio.playMusic(LevelClass.meta.music);
    audio.setIntensity(0);
    this.hintKey = null;
    this.lastProgressTime = 0;
    this.scanCooldown = 0;
    this.loadingLevel = false;

    if (cinematic && level.cinematic) {
      this.state = 'intro';
      this.introTime = 0;
      this.introCurve = new THREE.CatmullRomCurve3(level.cinematic.points);
      this.introTargets = new THREE.CatmullRomCurve3(level.cinematic.targets);
      this.ui.showIntro(LevelClass.meta);
      this.fxState.letterbox = 1;
    } else {
      this.beginPlay();
    }
    this.tween((k) => { this.fxState.fade = 1 - k; }, 0.6);
  }

  skipIntro() {
    if (this.state !== 'intro') return;
    this.introTime = Math.max(this.introTime, (this.level.cinematic.duration ?? 6) - 0.01);
  }

  beginPlay() {
    this.ui.hideIntro();
    this.fxState.letterbox = 0;
    this.state = 'playing';
    this.ui.showHud(true);
    this.level.start();
    this.player.updateCamera(0);
    if (!this.input.locked) {
      this.input.requestLock();
      setTimeout(() => {
        if (this.state === 'playing' && !this.input.locked) this.ui.showResume(true);
      }, 1500);
    }
  }

  completeLevel() {
    const level = this.level;
    const meta = level.constructor.meta;
    this.stats.time = level.time;
    this.runStats[this.levelIndex] = { ...this.stats };
    progress.unlock(meta.number + 1);
    const record = progress.recordTime(`level${meta.number}`, level.time);
    this.state = 'levelComplete';
    this.input.exitLock();
    audio.play('success');
    audio.say(`Level ${meta.number} complete.`);
    const logsTotal = level.terminals?.length ?? 0;
    this.ui.showHud(false);
    this.ui.showResult({
      kind: 'win',
      title: 'LEVEL COMPLETE',
      subtitle: `${meta.name} — ${meta.verb}`,
      record,
      stats: [
        ['Time', fmtTime(level.time)],
        ['Best', fmtTime(progress.values.bestTimes[`level${meta.number}`])],
        ['Reboots', this.stats.deaths],
        ['Damage taken', Math.round(this.stats.damageTaken)],
        ['Hints used', this.stats.hintsUsed],
        ['Data logs', `${this.stats.logs}/${logsTotal}`],
        ...(level.timeLimit ? [['Time remaining', fmtTime(level.timeLeft)]] : []),
        ...(this.stats.secrets ? [['Secrets', this.stats.secrets]] : [])
      ],
      buttons: [['continue', `Continue to level ${meta.number + 1}`, true], ['restart-level', 'Replay level'], ['quit', 'Main menu']]
    });
  }

  continueAfterResult() {
    this.ui.hideResult();
    if (this.state === 'levelComplete') this.loadLevel(this.levelIndex + 1);
    else if (this.state === 'victory') this.startNewGame();
  }

  gameOver(reason) {
    if (this.state !== 'playing' && this.state !== 'modal') return;
    this.state = 'gameOver';
    this.ui.closeModal();
    this.input.onKey = null;
    this.input.exitLock();
    this.ui.showHud(false);
    audio.playMusic('gameover', 0.5);
    audio.play('rumble');
    audio.say('Meltdown. Station lost.');
    this.ui.showResult({
      kind: 'fail',
      title: 'MELTDOWN',
      subtitle: reason,
      stats: [['Time survived', fmtTime(this.level.time)], ['Reboots', this.stats.deaths], ['Hints used', this.stats.hintsUsed]],
      buttons: [['restart-level', 'Try the level again', true], ['restart-game', 'Restart from level 1'], ['quit', 'Main menu']]
    });
  }

  victory() {
    this.stats.time = this.level.time;
    this.runStats[this.levelIndex] = { ...this.stats };
    this.state = 'victory';
    this.input.exitLock();
    this.ui.showHud(false);
    audio.playMusic('victory', 2);
    const fullRun = this.runFromLevel === 0 && this.runStats.filter(Boolean).length === 3;
    const total = this.runStats.reduce((acc, s) => {
      if (!s) return acc;
      for (const k of Object.keys(acc)) acc[k] += s[k];
      return acc;
    }, newStats());
    const rank = this.computeRank(total, fullRun);
    let record = false;
    if (fullRun) {
      record = progress.recordTime('fullRun', total.time);
      progress.recordRank(rank);
    }
    progress.recordTime('level3', this.level.time);
    this.victoryOrbit = 0;
    setTimeout(() => {
      if (this.state !== 'victory') return;
      this.ui.showResult({
        kind: 'win',
        title: 'CORE SEALED',
        subtitle: 'The station is safe. Well done, SPARK.',
        rank: fullRun ? rank : null,
        record,
        stats: [
          ['Total time', fmtTime(total.time)],
          ['Best full run', progress.values.bestTimes.fullRun ? fmtTime(progress.values.bestTimes.fullRun) : '—'],
          ['Reboots', total.deaths],
          ['Damage taken', Math.round(total.damageTaken)],
          ['Hints used', total.hintsUsed],
          ['Data logs found', total.logs],
          ['Breaker trips', total.mistakes],
          ['Sentry detections', total.detections],
          ['Thruster boosts', total.boosts],
          ['Difficulty', settings.difficulty.label]
        ],
        buttons: [['continue', 'Play again', true], ['credits', 'Credits'], ['quit', 'Main menu']]
      });
    }, 2600);
  }

  computeRank(total, fullRun) {
    let score = 100;
    score -= total.deaths * 7;
    score -= total.hintsUsed * 3;
    score -= total.mistakes * 4;
    score -= total.detections * 2;
    score += Math.min(10, total.logs * 1.5);
    const par = 660 * settings.difficulty.timeScale;
    if (total.time < par) score += 8;
    else if (total.time > par * 1.6) score -= 12;
    if (settings.get('difficulty') === 'hard') score += 6;
    if (settings.get('difficulty') === 'story') score -= 10;
    if (!fullRun) score -= 15;
    if (score >= 95) return 'S';
    if (score >= 80) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    return 'D';
  }

  restartLevel() {
    this.ui.hideResult();
    this.ui.showPause(false);
    this.loadLevel(this.levelIndex, { cinematic: false });
  }

  quitToMenu() {
    this.ui.hideAll();
    this.ui.closeModal();
    this.input.onKey = null;
    this.input.exitLock();
    if (this.level) {
      this.level.dispose();
      this.level = null;
    }
    audio.stopAllLoops();
    audio.silenceVoice();
    this.physics.clear();
    this.showMainMenu();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.pausedAt = performance.now();
    this.ui.showPause(true);
    this.ui.showResume(false);
    this.input.exitLock();
    audio.silenceVoice();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.ui.showPause(false);
    this.state = 'playing';
    this.input.requestLock();
    setTimeout(() => {
      if (this.state === 'playing' && !this.input.locked) this.ui.showResume(true);
    }, 1400);
  }

  onLockChange(locked, error = false) {
    if (locked) {
      this.ui.showResume(false);
      return;
    }
    // A refused lock request (e.g. too soon after Esc) is not a pause.
    if (error) {
      if (this.state === 'playing') this.ui.showResume(true);
      return;
    }
    if (this.state === 'playing') this.pause();
    else if (this.state === 'intro') this.skipIntro();
  }

  retryCheckpoint() {
    this.ui.showPause(false);
    this.state = 'playing';
    this.respawn('Restored from checkpoint');
    this.input.requestLock();
  }

  // The robot's integrity hit zero (or it was caught by the fire): glitch,
  // reboot and respawn at the last checkpoint. Timers keep running.
  playerDown(reason) {
    if (this.state !== 'playing') return;
    this.state = 'dead';
    this.stats.deaths++;
    this.player.frozen = true;
    this.deadTimer = 1.6;
    this.fxState.glitch = 1;
    audio.play('reboot');
    this.ui.toast(`SYSTEM FAILURE — ${reason}`, '#ff4455');
    this.ui.setPrompt(null);
  }

  // restore: full repair (after a reboot); otherwise damage taken is kept.
  respawn(reason, restore = false) {
    const level = this.level;
    this.player.spawn(level.checkpoint.position, level.checkpoint.yaw, restore);
    this.player.frozen = false;
    level.onRespawn?.();
    this.fxState.glitch = Math.max(this.fxState.glitch, 0.6);
    if (reason) this.ui.toast(reason, '#ffb020');
  }

  say(text) {
    this.ui.say(text);
    audio.say(text);
  }

  showLog(log) {
    this.enterModal(true);
    this.ui.showLog(log, () => this.exitModal());
  }

  collectLog(log) {
    this.stats.logs++;
    progress.addLog(log.id);
  }

  fxPulse(kind, amount) {
    if (kind === 'damage') this.fxState.damage = Math.max(this.fxState.damage, amount);
  }

  // ---------------------------------------------------------------- modals --
  openKeypad({ onSubmit }) {
    this.enterModal();
    this.ui.showKeypad(onSubmit, () => this.exitModal());
  }

  openSignalGame({ onWin }) {
    this.enterModal();
    this.ui.showSignalGame(onWin, () => this.exitModal());
  }

  openRoutingGrid({ onSolved }) {
    this.enterModal();
    this.ui.showRoutingGrid(onSolved, () => this.exitModal());
  }

  enterModal(freeze = false) {
    this.state = freeze ? 'modalPaused' : 'modal';
    this.player.frozen = true;
    this.input.exitLock();
    this.input.onKey = (e) => (this.ui.modalKey ? this.ui.modalKey(e) : false);
    this.ui.setPrompt(null);
  }

  exitModal() {
    this.input.onKey = null;
    this.player.frozen = false;
    if (this.state === 'modal' || this.state === 'modalPaused') {
      this.state = 'playing';
      this.input.requestLock();
      setTimeout(() => {
        if (this.state === 'playing' && !this.input.locked) this.ui.showResume(true);
      }, 1400);
    }
  }

  // ------------------------------------------------------------ gameplay --
  updateInteraction(dt) {
    const player = this.player;
    const input = this.input;
    const head = player.headPosition(_v);
    const look = player.lookDirection(_v2);
    let best = null;
    let bestScore = Infinity;
    for (const item of this.level.interactables) {
      if (!item.enabled()) continue;
      const dx = item.position.x - head.x, dy = item.position.y - head.y, dz = item.position.z - head.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > item.radius) continue;
      const flat = Math.hypot(dx, dz) || 1;
      const facing = (dx * look.x + dz * look.z) / flat / (Math.hypot(look.x, look.z) || 1);
      if (facing < 0.25 && dist > 1.1) continue;
      const score = dist * (2 - facing);
      if (score < bestScore) {
        bestScore = score;
        best = item;
      }
    }
    if (best !== this.focused) {
      this.focused = best;
      this.holdProgress = 0;
    }
    if (!best) {
      this.ui.setPrompt(null);
      return;
    }
    const prompt = typeof best.prompt === 'function' ? best.prompt() : best.prompt;
    const pressing = input.isDown('interact') || input.mouseDown[0];
    if (best.hold > 0) {
      if (pressing) {
        this.holdProgress += dt / best.hold;
        if (Math.floor(this.holdProgress * 8) !== Math.floor((this.holdProgress - dt / best.hold) * 8)) audio.play('servo', { volume: 0.4 });
        if (this.holdProgress >= 1) {
          this.holdProgress = 0;
          best.onInteract();
          this.markProgress();
        }
      } else {
        this.holdProgress = Math.max(0, this.holdProgress - dt * 2);
      }
      this.ui.setPrompt(prompt, this.holdProgress, true);
    } else {
      this.ui.setPrompt(prompt);
      if (input.wasPressed('interact') || input.mousePressed[0]) {
        best.onInteract();
        this.markProgress();
      }
    }
  }

  markProgress() {
    this.lastProgressTime = this.level?.time ?? 0;
  }

  triggerScan() {
    if (this.scanCooldown > 0) {
      audio.play('error', { volume: 0.4 });
      return;
    }
    this.scanCooldown = 8;
    this.scanTime = 5;
    audio.play('scan');
    if (!this.scanPulse) {
      this.scanPulse = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), createScanPulseMaterial());
      this.scanPulse.frustumCulled = false;
      this.scene.add(this.scanPulse);
    }
    this.scanPulse.position.copy(this.player.position).setY(this.player.position.y + 0.6);
    this.scanPulse.material.uniforms.uProgress.value = 0;
    this.scanPulse.visible = true;
    this.scanPulseAge = 0;
    const p = this.player.position;
    const items = this.level.scanTargets.filter((s) => s.active() && s.position.distanceTo(p) < 50);
    this.ui.showScan(items);
    if (!items.length) this.ui.toast('Scanner: nothing of interest nearby', '#37c8ff');
  }

  updateScan(dt) {
    this.scanCooldown = Math.max(0, this.scanCooldown - dt);
    this.ui.setScanCooldown(this.scanCooldown / 8);
    if (this.scanPulse?.visible) {
      this.scanPulseAge += dt;
      const k = Math.min(1, this.scanPulseAge / 1.4);
      this.scanPulse.scale.setScalar(0.5 + k * 40);
      this.scanPulse.material.uniforms.uProgress.value = k;
      if (k >= 1) this.scanPulse.visible = false;
    }
    if (this.scanTime > 0) {
      this.scanTime -= dt;
      const w = window.innerWidth, h = window.innerHeight;
      const camPos = this.camera.position;
      this.ui.updateScan((pos) => {
        _v.copy(pos).project(this.camera);
        if (_v.z > 1) return null;
        return { x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h, distance: pos.distanceTo(camPos) };
      }, Math.min(1, this.scanTime));
      if (this.scanTime <= 0) this.ui.hideScan();
    }
  }

  showHint() {
    const list = this.level.hints();
    const key = list[0];
    if (key !== this.hintKey) {
      this.hintKey = key;
      this.hintTier = 0;
    }
    if (this.hintTier < list.length) {
      this.hintTier++;
      this.stats.hintsUsed++;
    }
    this.ui.showHint(list[this.hintTier - 1], this.hintTier, list.length);
    audio.play('log');
  }

  // ------------------------------------------------------------------ loop --
  tween(fn, duration) {
    return new Promise((resolve) => {
      this.tweens.push({ fn, duration, t: 0, resolve });
    });
  }

  update(dt) {
    this.time += dt;
    for (const tw of [...this.tweens]) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.duration);
      tw.fn(k);
      if (k >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.resolve();
      }
    }

    const input = this.input;
    switch (this.state) {
      case 'menu':
        this.updateMenuScene(dt);
        break;
      case 'intro':
        this.updateIntro(dt);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'modal':
        // The world keeps running while a console is open (the clock is ticking).
        this.level.update(dt);
        this.updateHud();
        break;
      case 'dead':
        this.deadTimer -= dt;
        this.level.update(dt);
        this.player.updateCamera(dt);
        this.updateHud();
        if (this.deadTimer <= 0) {
          this.state = 'playing';
          this.respawn('Rebooted at last checkpoint', true);
        }
        break;
      case 'victory':
        this.level.update(dt);
        this.victoryOrbit += dt * 0.15;
        this.camera.position.set(Math.sin(this.victoryOrbit) * 13, 5 + Math.sin(this.victoryOrbit * 2) * 1.5, -113 + Math.cos(this.victoryOrbit) * 13);
        this.camera.lookAt(0, 5.5, -113);
        break;
      case 'paused':
        // P (or Esc once the mouse is released) resumes. The grace period stops
        // the Esc that released the pointer lock from immediately resuming.
        if (input.wasPressed('pause') && !this.ui.panelOpen && performance.now() - this.pausedAt > 400) this.resume();
        break;
      default:
        break;
    }

    if (!['playing', 'modal', 'dead'].includes(this.state)) {
      this.engine.minimap = null;
      this.ui.setMinimap(0, false);
    }
    this.updateFx(dt);
    audio.updateListener(this.camera);
    if (settings.get('showFps') && this.engine.fps) this.ui.setFps(this.engine.fps);
  }

  updateIntro(dt) {
    const dur = this.level.cinematic.duration ?? 6;
    this.introTime += dt;
    const k = Math.min(1, this.introTime / dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // ease in-out
    this.introCurve.getPoint(e, this.camera.position);
    this.introTargets.getPoint(e, _v);
    this.camera.lookAt(_v);
    // Only cosmetic animation runs during the fly-through; timers stay frozen.
    for (const fn of this.level.updatables) fn(dt, this.time);
    if (this.input.wasPressed('jump') || this.input.wasPressed('confirm') || this.input.mousePressed[0]) this.skipIntro();
    if (k >= 1) this.beginPlay();
  }

  updatePlaying(dt) {
    const input = this.input;
    const level = this.level;
    const player = this.player;

    if (input.wasPressed('pause')) {
      this.pause();
      return;
    }
    if (input.wasPressed('view')) player.toggleView();
    if (input.wasPressed('flashlight')) player.toggleFlashlight();
    if (input.wasPressed('map')) {
      this.minimapMode = (this.minimapMode + 1) % MINIMAP_SIZES.length;
      audio.play('ui');
    }
    if (input.wasPressed('hint')) this.showHint();
    if (input.wasPressed('scan') || input.mousePressed[2]) this.triggerScan();

    player.update(dt);
    level.update(dt);
    if (this.state !== 'playing') return;
    this.updateInteraction(dt);
    this.updateScan(dt);
    this.updateHud();

    // Gentle nudge if the player seems stuck.
    const objective = level.objectiveText?.() ?? level.objective;
    if (objective !== this.lastObjective) {
      this.lastObjective = objective;
      this.markProgress();
    }
    if (level.time - this.lastProgressTime > 75) {
      this.lastProgressTime = level.time;
      this.ui.toast('Stuck? Press H for a hint', '#ffb020');
    }

    // Low-integrity heartbeat.
    if (player.integrity < 30) {
      this.heartbeat -= dt;
      if (this.heartbeat <= 0) {
        this.heartbeat = 0.9;
        audio.play('beep', { pitch: 0.35, volume: 0.6 });
      }
    }
    // Final ten seconds countdown beeps.
    if (level.timeLimit) {
      const s = Math.ceil(level.timeLeft);
      if (s <= 10 && s !== this.countdownSecond) {
        this.countdownSecond = s;
        audio.play('countdown');
      }
    }
  }

  updateHud() {
    const level = this.level;
    const p = this.player;
    this.ui.setObjective(level.objectiveText?.() ?? level.objective);
    this.ui.setVitals({ integrity: p.integrity, stamina: p.stamina, battery: p.battery, flashlightOn: p.flashlightOn, exhausted: p.exhausted });
    if (level.timeLimit) this.ui.setTimer(level.timeLeft, level.timeLimit);
    else this.ui.setTimer(null);
    this.updateMinimap();
  }

  updateFx(dt) {
    const fx = this.engine.fx;
    const s = this.fxState;
    const motion = settings.get('motionFx');
    fx.uTime.value = this.time;
    s.damage = Math.max(0, s.damage - dt * 1.6);
    s.glitch = Math.max(0, s.glitch - dt * 0.8);
    fx.uDamage.value = s.damage;
    fx.uGlitch.value = motion ? s.glitch : s.glitch * 0.3;
    fx.uScanline.value = s.glitch * 0.6;
    fx.uFade.value = s.fade;
    const targetBox = s.letterbox ? 0.11 : 0;
    fx.uLetterbox.value = THREE.MathUtils.lerp(fx.uLetterbox.value, targetBox, 1 - Math.exp(-dt * 4));
    const inLevel = this.level && this.state !== 'menu';
    const low = inLevel && this.player.integrity < 30 ? 0.004 + Math.sin(this.time * 6) * 0.002 : 0;
    fx.uAberration.value = motion ? 0.0012 + low : 0.0005;
    fx.uGrain.value = 0.012;
    const heat = inLevel ? (this.level.heat ?? 0) : 0;
    fx.uHeat.value = THREE.MathUtils.lerp(fx.uHeat.value, heat, 1 - Math.exp(-dt * 2));
  }
}

// Merges simple non-indexed/indexed flat geometries into one.
function mergeFlat(geos) {
  const positions = [];
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    positions.push(...ng.attributes.position.array);
    if (ng !== g) ng.dispose();
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return out;
}
