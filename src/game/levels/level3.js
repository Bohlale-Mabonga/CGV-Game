// LEVEL 3 — MELTDOWN (Escape)
//
// The descent to the reactor. The corridor is tearing itself apart and a wall
// of fire is advancing behind SPARK. Four sections, each a different skill:
//   A  Collapse   — falling debris telegraphed by warning rings (dodge)
//   B  Molten pit — broken floor, a moving platform and a gap that needs the
//                   newly unlocked thruster double-jump (platforming)
//   C  Pistons    — crushing pistons slamming in sequence (timing)
//   D  The core   — three stabiliser pylons on raised platforms while the core
//                   hurls plasma flares at you, then seal it (set piece)
// What only this level has: the chase, double-jump thrusters, lava, the core
// boss-style finale.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Level } from '../level.js';
import { Door, Terminal, Pickup, makeSign, emissive } from '../objects/common.js';
import { textures } from '../../engine/textures.js';
import {
  createLavaMaterial, createFireWallMaterial, createHologramMaterial, applyDissolve,
  createSteamMaterial, createSteamGeometry
} from '../../shaders/effects.js';
import { createReactorCoreMaterial, createCoronaMaterial } from '../../shaders/reactorCore.js';
import { audio } from '../../engine/audio.js';
import { settings } from '../../engine/settings.js';
import { makeZone, pointInBox } from '../../engine/physics.js';

const W = 3; // corridor half-width
const CORE = new THREE.Vector3(0, 6.5, -113);
const CHAMBER_R = 15;
const PIT_R = 6;

const LOG = {
  id: 'LOG 31-X',
  title: 'ARIA — automated incident report',
  body: 'Containment field failure in progress. Core temperature 3,410 K.\n\nTo seal the core: bring the three stabiliser pylons around the reactor chamber online. The stabilisers will extend the access bridge to the central sealing console.\n\nEmergency thruster override for maintenance units has been granted.'
};

export class Level3 extends Level {
  static meta = {
    number: 3,
    name: 'MELTDOWN',
    verb: 'ESCAPE',
    tagline: 'Outrun the collapse and seal the reactor core before it breaches.',
    music: 'level3'
  };

  build() {
    const game = this.game;
    this.batteryDrain = 0.4;
    this.timeLimit = 200 * settings.difficulty.timeScale;
    this.timeLeft = this.timeLimit;
    this.fireZ = 14;
    this.fireDelay = 6;
    this.fireActive = true;
    this.pylonsOnline = 0;
    this.sealed = false;
    this.inChamber = false;
    this.flareTimer = 4;

    const rubble = textures.set('rubble', 1, 1);
    this.mat = {
      wall: this.standardSet('panels', 1, { color: 0x6f5f58, metalness: 0.45, roughness: 0.7 }),
      floor: this.standardSet('floor', 1, { color: 0x7c706a, metalness: 0.55 }),
      rubble: new THREE.MeshStandardMaterial({
        ...rubble, color: 0xb59a86, displacementScale: 0.45, displacementBias: -0.2,
        emissive: 0xff4a10, emissiveIntensity: 0.9
      }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2a2626, metalness: 0.8, roughness: 0.45, ...textures.brushed(), bumpScale: 0.4 }),
      hazard: this.standardSet('hazard', 1, { roughness: 0.6 }),
      platform: new THREE.MeshStandardMaterial({ ...textures.set('panels'), color: 0x8d8f96, metalness: 0.6, roughness: 0.5 }),
      red: emissive(0xff2a1a, 3.5),
      orange: emissive(0xff8a1f, 3),
      cyan: emissive(0x37c8ff, 3)
    };

    this.buildCorridor();
    this.buildSectionA();
    this.buildSectionB();
    this.buildSectionC();
    this.buildChamber();
    this.buildFireWall();
    this.finalizeStatic();

    game.scene.background = textures.starCube();
    game.scene.fog = new THREE.FogExp2(0x1a0804, 0.028);
    game.scene.environmentIntensity = 0.35;

    this.checkpoint.position.set(0, 0, -1);
    this.checkpoint.yaw = 0;
    this.objective = 'Escape the collapse — reach the reactor chamber';
    this.cinematic = {
      duration: 7.5,
      points: [
        new THREE.Vector3(0, 9, -100), new THREE.Vector3(0, 3.5, -84),
        new THREE.Vector3(1.5, 2.5, -55), new THREE.Vector3(-1, 2.2, -22), new THREE.Vector3(0, 1.05, -1)
      ],
      targets: [
        CORE.clone(), new THREE.Vector3(0, 4, -110),
        new THREE.Vector3(0, 0, -70), new THREE.Vector3(0, 1.5, -40), new THREE.Vector3(0, 1, -10)
      ]
    };
  }

  // Corridor shell for a z-range: floor (optional), displaced rubble walls,
  // ceiling with breaches through which space is visible.
  shell(z0, z1, { floor = true, height = 5, breach = false } = {}) {
    const len = z0 - z1;
    const zc = (z0 + z1) / 2;
    if (floor) this.box(W * 2 + 2, 0.4, len, 0, -0.2, zc, this.mat.floor, { tile: 2 });
    // Walls: collider boxes + finely tessellated displaced rubble planes.
    for (const side of [-1, 1]) {
      this.physics.addBox(side * W, -6, z1, side * (W + 1), height + 1, z0);
      const geo = new THREE.PlaneGeometry(len, height + 4, Math.ceil(len * 2.2), 14);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 4, uv.getY(i) * (height + 4) / 4);
      const wall = new THREE.Mesh(geo, this.mat.rubble);
      wall.rotation.y = -side * Math.PI / 2;
      wall.position.set(side * (W + 0.15), height / 2 - 2, zc);
      wall.receiveShadow = true;
      this.add(wall);
    }
    // Ceiling — with a gap in the middle when breached.
    if (breach) {
      const part = len * 0.3;
      this.box(W * 2 + 2, 0.5, part, 0, height + 0.25, z0 - part / 2, this.mat.dark, { tile: 2, minimap: false });
      this.box(W * 2 + 2, 0.5, part, 0, height + 0.25, z1 + part / 2, this.mat.dark, { tile: 2, minimap: false });
      // Broken girders across the breach.
      for (let k = 0; k < 3; k++) {
        const z = z0 - part - (len - part * 2) * (k + 0.5) / 3;
        this.box(W * 2 + 1.6, 0.25, 0.25, 0, height + 0.1, z, this.mat.dark, { collide: false, rotationY: (k - 1) * 0.25 });
      }
    } else {
      this.box(W * 2 + 2, 0.5, len, 0, height + 0.25, zc, this.mat.dark, { tile: 2, minimap: false });
    }
  }

  buildCorridor() {
    // Arrival lift.
    this.shell(4, -4, { height: 4 });
    this.box(W * 2 + 2, 6, 1, 0, 2, 4.5, this.mat.wall);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.4, 48), this.mat.cyan);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.02, 1.5);
    this.add(ring);
    makeSign(this, '⚠ MELTDOWN IN PROGRESS', { x: 0, y: 3.3, z: 3.95, rotationY: Math.PI, width: 3.4, height: 0.5, color: '#ff4a2a' });
    makeSign(this, 'REACTOR CORE ▼ 110 M', { x: 0, y: 3.4, z: -3.9, width: 2.8, height: 0.45, color: '#ff8a3a' });

    // Rotating alarm beacons (moving spot lights).
    this.beacons = [];
    for (const z of [-18, -56, -84]) {
      const g = new THREE.Group();
      g.position.set(W - 0.3, 4.4, z);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), this.mat.red);
      g.add(dome);
      const spot = new THREE.SpotLight(0xff2a1a, 80, 18, 0.4, 0.5, 1.6);
      const target = new THREE.Object3D();
      target.position.set(-3, -3, 0);
      g.add(spot, target);
      spot.target = target;
      this.add(g);
      this.beacons.push(g);
    }
    this.add(new THREE.HemisphereLight(0xff9a6a, 0x200a04, 0.5));
  }

  // --------------------------------------------------------- A: collapse --
  buildSectionA() {
    this.shell(-4, -40, { breach: true });
    // Fallen girders to vault over.
    for (const [z, x, w] of [[-12, -1.2, 3.4], [-24, 1.4, 3.0], [-33, -0.8, 4.2]]) {
      this.box(w, 0.7, 0.6, x, 0.35, z, this.mat.dark, { tile: 1 });
      this.box(w + 0.02, 0.1, 0.62, x, 0.66, z, this.mat.hazard, { collide: false, tile: 1 });
    }
    // Debris pool: rubble chunks with a dissolve shader injected into PBR.
    this.debris = [];
    const geos = [new THREE.DodecahedronGeometry(0.75, 0), new THREE.IcosahedronGeometry(0.7, 0), new THREE.DodecahedronGeometry(0.6, 1)];
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.MeshStandardMaterial({ ...textures.set('rubble'), color: 0x9a8676, roughness: 0.9, flatShading: true, displacementMap: null });
      const dissolve = applyDissolve(mat);
      const mesh = new THREE.Mesh(geos[i % 3], mat);
      mesh.castShadow = true;
      mesh.visible = false;
      this.add(mesh);
      const warn = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({
        map: textures.warningRing(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0
      }));
      warn.rotation.x = -Math.PI / 2;
      warn.visible = false;
      this.add(warn);
      this.debris.push({ mesh, warn, dissolve, state: 'idle', t: 0, vy: 0, spin: new THREE.Vector3() });
    }
    this.debrisTimer = 2;

    // Falling sparks through the ceiling breach (GPU particles).
    this.sparkMats = [];
    for (const z of [-15, -30]) {
      const mat = createSteamMaterial(textures.softDot(), { color: 0xffa040, length: 5.2, spread: 2.2, size: 0.35 });
      mat.uniforms.uDir.value.set(0, -1, 0);
      mat.uniforms.uBurst.value = 1;
      mat.blending = THREE.AdditiveBlending;
      const pts = new THREE.Points(createSteamGeometry(160), mat);
      pts.position.set(0, 5.2, z);
      pts.frustumCulled = false;
      this.add(pts);
      this.sparkMats.push(mat);
    }

    new Terminal(this, { x: -2.2, z: -6, rotationY: Math.PI / 2, log: LOG });
    this.pickups = [new Pickup(this, { position: new THREE.Vector3(2, 1.0, -28), kind: 'repair' })];
    this.zoneA = makeZone(-W, -1, -40, W, 6, -4);
  }

  // ------------------------------------------------------- B: molten pit --
  buildSectionB() {
    this.shell(-40, -68.5, { floor: false, breach: true });
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 + 1, 30, 40, 120), createLavaMaterial());
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(0, -3.2, -54.25);
    this.add(lava);
    this.lavaMat = lava.material;
    for (const z of [-45, -62]) {
      const glow = new THREE.PointLight(0xff5a10, 30, 16, 1.6);
      glow.position.set(0, -1.6, z);
      this.add(glow);
    }
    // Static platforms: [x0, x1, z0, z1, top]
    const plats = [
      [-2, 2, -42.5, -44.6, 0],
      [-3, 0.2, -46.6, -48.8, 0.8],
      [-2.6, 2.6, -59, -61.2, 2.2],
      [-1.2, 2.6, -63.6, -66, 1.2]
    ];
    for (const [x0, x1, z0, z1, top] of plats) {
      const h = top + 3;
      this.box(x1 - x0, h, z0 - z1, (x0 + x1) / 2, top - h / 2, (z0 + z1) / 2, this.mat.platform, { tile: 1.5 });
      this.box(x1 - x0 + 0.02, 0.06, 0.2, (x0 + x1) / 2, top + 0.01, z0 - 0.1, this.mat.hazard, { collide: false, tile: 1 });
    }
    // Moving platform — carries the player (see update()).
    const mp = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.5, 2.6, 2, 0.06), this.mat.platform);
    mp.castShadow = mp.receiveShadow = true;
    const mpStrip = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.08, 0.2), this.mat.orange);
    mpStrip.position.set(0, 0.2, 1.2);
    mp.add(mpStrip);
    this.add(mp);
    this.movingPlatform = {
      mesh: mp,
      collider: this.physics.addBox(-1.2, 0.3, -54.3, 1.2, 0.8, -51.7, { tag: 'platform' }),
      x: 0,
      prevX: 0
    };
    makeSign(this, 'THRUSTERS: [SPACE] ×2', { x: -W + 0.05, y: 3.2, z: -54, rotationY: Math.PI / 2, width: 2.6, height: 0.42, color: '#37c8ff' });
    this.zoneB = makeZone(-W, -10, -68.5, W, 8, -40);
    this.pickups.push(new Pickup(this, { position: new THREE.Vector3(1.0, 3.2, -60), kind: 'repair' }));
  }

  // --------------------------------------------------------- C: pistons --
  buildSectionC() {
    this.shell(-68.5, -98.6, { height: 6 });
    this.pistons = [];
    [-75, -80.5, -86, -91.5].forEach((z, i) => {
      const g = new THREE.Group();
      g.position.set(0, 0, z);
      const head = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 2.6, 2.4), this.mat.dark);
      head.castShadow = head.receiveShadow = true;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.02, 0.25, 2.42), this.mat.hazard);
      stripe.position.y = -1.15;
      const warn = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.04, 0.1, 2.44), emissive(0xff2a1a, 0));
      warn.position.y = -1.32;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4, 12), this.mat.dark);
      shaft.position.y = 3.2;
      head.add(stripe, warn, shaft);
      g.add(head);
      this.add(g);
      // Floor marking under each piston.
      this.box(W * 2, 0.02, 2.4, 0, 0.012, z, this.mat.hazard, { collide: false, tile: 1 });
      const collider = this.physics.addBox(-W, 4.6, z - 1.2, W, 7.2, z + 1.2, { tag: 'piston' });
      this.pistons.push({ z, head, warn: warn.material, collider, offset: i * 0.75, y: 4.6, slammed: false });
    });
    this.zoneC = makeZone(-W, -1, -97, W, 8, -68.5);
  }

  pistonHeight(p, t) {
    // Cycle (3 s): up 1.2 → shake 0.45 → slam 0.15 → hold 0.5 → rise 0.7
    const c = ((t + p.offset) % 3 + 3) % 3;
    const up = 4.6;
    if (c < 1.2) return { y: up, warn: 0 };
    if (c < 1.65) return { y: up + Math.sin(c * 80) * 0.03, warn: (c - 1.2) / 0.45 };
    if (c < 1.8) return { y: up * (1 - (c - 1.65) / 0.15), warn: 1 };
    if (c < 2.3) return { y: 0, warn: 1 };
    return { y: up * ((c - 2.3) / 0.7), warn: 0 };
  }

  // ------------------------------------------------------- D: the chamber --
  buildChamber() {
    const cz = CORE.z;
    const gapHalf = Math.asin((W + 0.2) / CHAMBER_R);
    // Blast door that slams shut behind SPARK when they enter.
    this.chamberDoor = new Door(this, { x: 0, z: -97.4, width: W * 2 - 0.2, height: 4.2, locked: false, color: 0xff8a3a });
    this.chamberDoor.open(true);
    this.chamberDoor.progress = 1;

    // Floor ring around the pit (analytic ring collider) and the pit itself.
    this.physics.addRing(0, cz, PIT_R, CHAMBER_R + 1, -0.4, 0, {});
    const floorTex = textures.set('floor', 14, 14);
    const floor = new THREE.Mesh(new THREE.RingGeometry(PIT_R, CHAMBER_R + 0.5, 96, 2), new THREE.MeshStandardMaterial({ ...floorTex, color: 0x8a807a, metalness: 0.65 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, cz);
    floor.receiveShadow = true;
    this.add(floor);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(PIT_R, 0.12, 8, 96), this.mat.orange);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(0, 0.02, cz);
    this.add(lip);
    // Pit walls (lathe) and molten glow at the bottom.
    const pitWall = new THREE.Mesh(new THREE.CylinderGeometry(PIT_R, PIT_R * 0.8, 6, 64, 1, true), new THREE.MeshStandardMaterial({ ...textures.set('rubble', 6, 2), color: 0x6a5a50, side: THREE.BackSide, emissive: 0xff4a10, emissiveIntensity: 1.2 }));
    pitWall.position.set(0, -3, cz);
    this.add(pitWall);
    const pitLava = new THREE.Mesh(new THREE.CircleGeometry(PIT_R, 48), createLavaMaterial());
    pitLava.rotation.x = -Math.PI / 2;
    pitLava.position.set(0, -5.5, cz);
    this.add(pitLava);
    this.pitLavaMat = pitLava.material;

    // Chamber wall (curved) with a gap for the corridor, and a lathe-turned
    // reactor housing ring overhead.
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(CHAMBER_R, CHAMBER_R, 14, 96, 1, true, gapHalf, Math.PI * 2 - gapHalf * 2),
      new THREE.MeshStandardMaterial({ ...textures.set('panels', 22, 6), color: 0x7b6c66, metalness: 0.55, side: THREE.BackSide })
    );
    wall.position.set(0, 7, cz);
    wall.receiveShadow = true;
    this.add(wall);
    this.physics.addRing(0, cz, CHAMBER_R, CHAMBER_R + 2, -6, 14, { gaps: [{ angle: Math.PI / 2, half: gapHalf }], blocksSight: true });
    const profile = [];
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      profile.push(new THREE.Vector2(CHAMBER_R - 0.2 - Math.sin(k * Math.PI) * 4.5, 10 + k * 4));
    }
    const housing = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), new THREE.MeshStandardMaterial({ color: 0x3a3536, metalness: 0.85, roughness: 0.35, side: THREE.DoubleSide }));
    housing.position.set(0, 0, cz);
    this.add(housing);
    for (const y of [3, 9.6]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(CHAMBER_R - 0.1, 0.07, 8, 128), this.mat.orange);
      band.rotation.x = Math.PI / 2;
      band.position.set(0, y, cz);
      this.add(band);
    }

    // The reactor core: custom displacement shader + additive corona,
    // inside three containment rings (hierarchy: Core → RingPivot → Ring).
    this.coreGroup = new THREE.Group();
    this.coreGroup.position.copy(CORE);
    this.coreMat = createReactorCoreMaterial();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 24), this.coreMat);
    this.coreGroup.add(core);
    this.coronaMat = createCoronaMaterial();
    const corona = new THREE.Mesh(new THREE.SphereGeometry(4.4, 48, 24), this.coronaMat);
    this.coreGroup.add(corona);
    this.coreRings = [];
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x4a4446, metalness: 0.9, roughness: 0.3 });
    for (let i = 0; i < 3; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.set(i * 1.1, i * 0.7, i * 0.4);
      const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(3.6 + i * 0.45, 0.14, 10, 96), ringMat);
      const glowMat = emissive(0xff3a10, 2.5);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(3.6 + i * 0.45, 0.05, 6, 96), glowMat);
      glow.position.z = 0.12;
      ringMesh.add(glow);
      pivot.add(ringMesh);
      this.coreGroup.add(pivot);
      this.coreRings.push({ pivot, glowMat, speed: 0.6 + i * 0.35, locked: false });
    }
    this.add(this.coreGroup);
    this.coreLight = new THREE.PointLight(0xff6a20, 220, 45, 1.6);
    this.coreLight.position.copy(CORE);
    this.add(this.coreLight);
    this.addMarker(new THREE.Vector3(CORE.x, 0, CORE.z), '#ff6a20', 'core');

    // Central sealing platform + extendable bridge.
    this.box(4, 6, 4, 0, -3, cz, this.mat.platform, { tile: 1.5 });
    this.box(4.02, 0.06, 4.02, 0, 0.01, cz, this.mat.hazard, { collide: false, tile: 1 });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 4.1), this.mat.platform);
    bridge.position.set(0, -0.15, cz + 4.05);
    bridge.scale.z = 0.001;
    bridge.castShadow = bridge.receiveShadow = true;
    this.add(bridge);
    this.bridge = { mesh: bridge, extend: 0, collider: this.physics.addBox(-1.1, -0.3, cz + 2, 1.1, 0, cz + 6.1, { enabled: false }) };
    const sealConsole = new THREE.Group();
    sealConsole.position.set(0, 0, cz + 1.3);
    const desk = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.1, 0.7, 2, 0.06), this.mat.dark);
    desk.position.y = 0.55;
    const panelMat = emissive(0x37c8ff, 2.2);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.4), panelMat);
    panel.position.set(0, 1.12, 0.12);
    panel.rotation.x = -Math.PI / 2 + 0.4;
    sealConsole.add(desk, panel);
    this.add(sealConsole);
    this.sealPanelMat = panelMat;
    this.physics.addCentered(0, 0.55, cz + 1.3, 1.6, 1.1, 0.7);
    this.addInteractable({
      position: new THREE.Vector3(0, 1.0, cz + 2.0),
      radius: 2.0,
      hold: 3.0,
      prompt: 'Hold E — SEAL THE REACTOR CORE',
      enabled: () => this.pylonsOnline === 3 && !this.sealed,
      onInteract: () => this.sealCore()
    });

    // Three stabiliser pylons on raised platforms.
    this.pylons = [];
    const defs = [
      // [height, distance from platform centre]; heights rise toward the platform.
      { angle: Math.PI, r: 11, top: 1.2, steps: [] },
      { angle: 0, r: 11, top: 2.4, steps: [[1.2, 2.4]] },
      { angle: -Math.PI / 2, r: 11.8, top: 3.6, steps: [[2.4, 2.4], [1.2, 4.1]] }
    ];
    for (const def of defs) {
      const dir = new THREE.Vector3(Math.cos(def.angle), 0, Math.sin(def.angle));
      const center = dir.clone().multiplyScalar(def.r).add(new THREE.Vector3(0, 0, cz));
      this.box(3.2, def.top, 3.2, center.x, def.top / 2, center.z, this.mat.platform, { tile: 1.5 });
      this.box(3.22, 0.06, 3.22, center.x, def.top + 0.01, center.z, this.mat.hazard, { collide: false, tile: 1 });
      // Stepping blocks toward the pit edge.
      def.steps.forEach(([h, dist]) => {
        const p = center.clone().addScaledVector(dir, -dist - 0.4);
        this.box(1.6, h, 1.6, p.x, h / 2, p.z, this.mat.platform, { tile: 1.5 });
      });
      const g = new THREE.Group();
      g.position.set(center.x, def.top, center.z);
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.6, 16), this.mat.dark);
      column.position.y = 1.3;
      column.castShadow = true;
      const bandMat = emissive(0xff3a10, 2.5);
      for (const y of [0.6, 1.4, 2.2]) {
        const b = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 8, 24), bandMat);
        b.rotation.x = Math.PI / 2;
        b.position.y = y;
        g.add(b);
      }
      g.add(column);
      // Energy tether to the core, invisible until the pylon is online.
      const holo = createHologramMaterial(0x37c8ff, 0);
      const start = new THREE.Vector3(center.x, def.top + 2.6, center.z);
      const len = start.distanceTo(CORE);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, len, 12, 1, true), holo);
      beam.position.copy(start).lerp(CORE, 0.5);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), CORE.clone().sub(start).normalize());
      this.add(g, beam);
      this.physics.addCentered(center.x, def.top + 1.3, center.z, 0.9, 2.6, 0.9);
      const pylon = { center, top: def.top, group: g, bandMat, holo, online: false };
      this.pylons.push(pylon);
      const interactPos = center.clone().addScaledVector(dir, -1.0).setY(def.top + 1.0);
      this.addInteractable({
        position: interactPos,
        radius: 1.9,
        hold: 1.5,
        prompt: 'Hold E — bring stabiliser online',
        enabled: () => !pylon.online,
        onInteract: () => this.activatePylon(pylon)
      });
      this.addMarker(center, '#37c8ff', 'square', { visible: () => !pylon.online });
      this.addScanTarget(interactPos, 'STABILISER', '#37c8ff', () => !pylon.online);
    }

    // Plasma flares: warning ring then a column of plasma at the player.
    this.flares = [];
    for (let i = 0; i < 3; i++) {
      const warn = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({
        map: textures.warningRing(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0
      }));
      warn.rotation.x = -Math.PI / 2;
      warn.visible = false;
      const colMat = createFireWallMaterial();
      const column = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 14, 20, 12, true), colMat);
      column.visible = false;
      this.add(warn, column);
      this.flares.push({ warn, column, colMat, state: 'idle', t: 0, pos: new THREE.Vector3() });
    }

    this.chamberZone = makeZone(-CHAMBER_R, -10, CORE.z - CHAMBER_R, CHAMBER_R, 20, -98.5);
    this.pickups.push(new Pickup(this, { position: new THREE.Vector3(-8, 1.0, cz + 8), kind: 'repair' }));
    makeSign(this, 'STABILISERS ◂ W · N · E ▸', { x: 0, y: 4.9, z: -98.0, width: 3.2, height: 0.42, color: '#37c8ff' });
  }

  buildFireWall() {
    this.fireMat = createFireWallMaterial();
    this.fire = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 + 0.6, 6, 30, 24), this.fireMat);
      sheet.position.set(0, 3, i * 0.9);
      this.fire.add(sheet);
    }
    this.fire.position.z = this.fireZ;
    this.add(this.fire);
    this.fireLight = new THREE.PointLight(0xff5a10, 60, 18, 1.6);
    this.fireLight.position.set(0, 2.5, -1.5);
    this.fire.add(this.fireLight);
    this.fireLoop = this.addLoop('fire', new THREE.Vector3(0, 2, this.fireZ), 0.0);
    this.addMarker(this.fire, '#ff4a10', 'fire');
  }

  // ------------------------------------------------------------- actions --
  activatePylon(pylon) {
    pylon.online = true;
    this.pylonsOnline++;
    pylon.bandMat.emissive.set(0x37c8ff);
    this.game.player.rig.triggerReach();
    audio.play('junction', { position: pylon.center });
    const ring = this.coreRings[this.pylonsOnline - 1];
    ring.locked = true;
    ring.glowMat.emissive.set(0x37c8ff);
    this.game.ui.toast(`Stabiliser online (${this.pylonsOnline}/3)`, '#37c8ff');
    this.checkpoint.position.copy(this.game.player.position);
    this.checkpoint.yaw = this.game.player.yaw;
    if (this.pylonsOnline === 1) this.game.say('Stabiliser one holding. The core is fighting back — watch for plasma flares!');
    if (this.pylonsOnline === 2) this.game.say('Two of three. Containment rising.');
    if (this.pylonsOnline === 3) {
      this.game.say('All stabilisers online. The bridge is extending — get to the sealing console!');
      this.objective = 'Cross the bridge and SEAL the core';
      audio.play('door', { position: new THREE.Vector3(0, 0, CORE.z + 4) });
    }
  }

  sealCore() {
    this.sealed = true;
    this.timeFrozen = true;
    this.sealPanelMat.emissive.set(0x37ff8b);
    audio.play('seal');
    this.game.say('Seal engaged. Core temperature falling... SPARK, you did it. The station is safe.');
    this.game.player.rig.triggerReach();
    this.sealTime = 0;
    for (const f of this.flares) {
      f.state = 'idle';
      f.warn.visible = false;
      f.column.visible = false;
    }
    this.after(4.5, () => {
      if (!this.completed) {
        this.completed = true;
        this.game.victory();
      }
    });
  }

  // ------------------------------------------------------------ lifecycle --
  start() {
    this.game.player.abilities.doubleJump = true;
    this.game.say('The reactor is going critical and this section is collapsing behind you. Emergency thrusters unlocked — press jump again in mid-air. RUN!');
    this.game.ui.hintPrompt('New ability: THRUSTER DOUBLE-JUMP — press Space again mid-air');
    audio.play('alarm');
    audio.play('rumble');
  }

  onRespawn() {
    // Keep the fire a fair distance behind wherever the checkpoint is.
    if (!this.inChamber) this.fireZ = Math.max(this.fireZ, this.checkpoint.position.z + 16);
    this.fireDelay = 2.5;
    for (const d of this.debris) {
      d.state = 'idle';
      d.mesh.visible = false;
      d.warn.visible = false;
    }
  }

  update(dt) {
    super.update(dt);
    const game = this.game;
    const player = game.player;
    const p = player.position;
    const t = this.time;

    // Countdown (frozen once sealed).
    if (!this.sealed) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        game.gameOver('Core breach. The reactor went critical before it could be sealed.');
        return;
      }
    }

    // Checkpoints at each section boundary.
    const cps = [[-40.2, -39], [-68.6, -69.2], [-98.6, -99.5]];
    for (const [trigger, z] of cps) {
      if (p.z < trigger && this.checkpoint.position.z > z + 0.5 && player.body.grounded) {
        this.checkpoint.position.set(0, 0, z);
        this.checkpoint.yaw = 0;
        game.ui.toast('Checkpoint', '#37c8ff');
      }
    }

    this.updateFire(dt, t);
    this.updateDebris(dt, t);
    this.updatePlatform(dt, t);
    this.updatePistons(dt, t);
    this.updateChamber(dt, t);
    for (const pk of this.pickups) pk.update(dt, t);
    for (const b of this.beacons) b.rotation.y += dt * 3;
    for (const m of this.sparkMats) m.uniforms.uTime.value = t;
    this.lavaMat.uniforms.uTime.value = t;
    this.pitLavaMat.uniforms.uTime.value = t;
    this.chamberDoor.update(dt);

    // Falling into molten metal.
    if (p.y < -2.0) {
      audio.play('lava');
      game.stats.falls++;
      player.damage(34, null, 0, 'Fell into molten metal');
      if (game.state === 'playing') game.respawn('You fell into the molten pit');
    }

    // Heat: post-processing haze + music intensity.
    const urgency = 1 - this.timeLeft / this.timeLimit;
    const nearCore = Math.max(0, 1 - p.distanceTo(CORE) / 30);
    const fireNear = this.fireActive ? Math.max(0, 1 - (this.fireZ - p.z) / 20) : 0;
    this.heat = this.sealed ? 0 : Math.min(1, 0.25 + urgency * 0.4 + nearCore * 0.5 + fireNear * 0.4);
    game.audio.setIntensity(this.sealed ? 0 : Math.max(urgency, fireNear, nearCore * 0.8));
  }

  updateFire(dt, t) {
    const game = this.game;
    const player = game.player;
    this.fireMat.uniforms.uTime.value = t;
    if (!this.fireActive) {
      this.fireMat.uniforms.uIntensity.value = Math.max(0, this.fireMat.uniforms.uIntensity.value - dt * 0.5);
      return;
    }
    if (this.fireDelay > 0) {
      this.fireDelay -= dt;
    } else {
      // Rubber-band: faster when far behind (tension), slower when close (fairness).
      const gap = this.fireZ - player.position.z;
      let speed = 2.3;
      if (gap > 22) speed = 4.5;
      else if (gap < 7) speed = 1.6;
      this.fireZ -= speed * settings.difficulty.chaseSpeed * dt;
    }
    this.fireZ = Math.max(this.fireZ, -95);
    this.fire.position.z = this.fireZ;
    this.fireLight.intensity = 50 + Math.sin(t * 13) * 10;
    if (this.fireLoop) {
      this.fireLoop.setPosition(this.fire.position);
      this.fireLoop.setVolume(0.6);
    }
    if (player.position.z > this.fireZ - 0.9 && game.state === 'playing') {
      game.playerDown('Consumed by the collapse');
    }
  }

  updateDebris(dt, t) {
    const player = this.game.player;
    const p = player.position;
    const active = pointInBox(p, this.zoneA);
    this.debrisTimer -= dt;
    if (active && this.debrisTimer <= 0) {
      this.debrisTimer = 0.9 + Math.random() * 0.8;
      const d = this.debris.find((k) => k.state === 'idle');
      if (d) {
        // Land ahead of the player, biased toward where they are heading.
        const ahead = 3 + Math.random() * 7;
        const x = THREE.MathUtils.clamp(p.x + (Math.random() - 0.5) * 4, -W + 0.8, W - 0.8);
        const z = p.z - ahead;
        d.state = 'warn';
        d.t = 0;
        d.target = new THREE.Vector3(x, 0, z);
        d.warn.position.set(x, 0.03, z);
        d.warn.visible = true;
        d.mesh.visible = false;
      }
    }
    for (const d of this.debris) {
      if (d.state === 'idle') continue;
      d.t += dt;
      if (d.state === 'warn') {
        d.warn.material.opacity = 0.4 + 0.5 * Math.abs(Math.sin(d.t * 10));
        d.warn.scale.setScalar(1.2 - d.t * 0.25);
        if (d.t > 0.7) {
          d.state = 'fall';
          d.mesh.visible = true;
          d.mesh.position.set(d.target.x, 7, d.target.z);
          d.vy = -4;
          d.spin.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
          d.dissolve.uDissolve.value = 0;
        }
      } else if (d.state === 'fall') {
        d.vy -= 30 * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.rotation.x += d.spin.x * dt;
        d.mesh.rotation.z += d.spin.z * dt;
        if (d.mesh.position.y <= 0.6) {
          d.mesh.position.y = 0.6;
          d.state = 'landed';
          d.t = 0;
          d.warn.visible = false;
          audio.play('crash', { position: d.mesh.position });
          const dist = Math.hypot(p.x - d.target.x, p.z - d.target.z);
          player.addShake(Math.max(0, 0.5 - dist * 0.05));
          if (dist < 1.5 && p.y < 2) player.damage(30, d.target, 7, 'Crushed by falling debris');
        }
      } else if (d.state === 'landed') {
        // Burn away with the dissolve shader.
        if (d.t > 0.8) d.dissolve.uDissolve.value = Math.min(1, (d.t - 0.8) * 0.9);
        if (d.t > 2.0) {
          d.state = 'idle';
          d.mesh.visible = false;
        }
      }
    }
  }

  updatePlatform(dt, t) {
    const mp = this.movingPlatform;
    mp.prevX = mp.x;
    mp.x = Math.sin(t * 1.4) * 1.6;
    mp.mesh.position.set(mp.x, 0.55, -53);
    mp.collider.min.x = mp.x - 1.2;
    mp.collider.max.x = mp.x + 1.2;
    // Carry the player when standing on it.
    const body = this.game.player.body;
    if (body.grounded && body.groundCollider === mp.collider) {
      body.position.x += mp.x - mp.prevX;
    }
  }

  updatePistons(dt, t) {
    const player = this.game.player;
    const p = player.position;
    for (const ps of this.pistons) {
      const { y, warn } = this.pistonHeight(ps, t);
      const wasUp = ps.y > 1.5;
      ps.y = y;
      ps.head.position.y = y + 1.3;
      ps.warn.emissiveIntensity = warn * 4;
      ps.collider.min.y = y;
      ps.collider.max.y = y + 2.6;
      // Solid only when fully raised or fully down; while moving, the crush
      // check below handles contact (otherwise physics would lift the robot
      // on top of the descending head).
      ps.collider.enabled = y > 4.2 || y < 0.05;
      if (wasUp && y < 0.5 && Math.abs(p.z - ps.z) < 12) {
        audio.play('piston', { position: new THREE.Vector3(0, 0.5, ps.z) });
        player.addShake(Math.max(0, 0.35 - Math.abs(p.z - ps.z) * 0.04));
      }
      // Crushed if under the head while it is low.
      if (y < player.body.height + p.y - 0.1 && Math.abs(p.z - ps.z) < 1.2 + player.body.radius - 0.05 && Math.abs(p.x) < W) {
        const out = p.z > ps.z ? ps.z + 1.2 + player.body.radius + 0.05 : ps.z - 1.2 - player.body.radius - 0.05;
        p.z = out;
        player.damage(40, new THREE.Vector3(p.x, 0, ps.z), 6, 'Crushed by a piston');
      }
    }
  }

  updateChamber(dt, t) {
    const game = this.game;
    const player = game.player;
    const p = player.position;

    // Entering the chamber: the fire is shut out behind a blast door.
    if (!this.inChamber && pointInBox(p, this.chamberZone)) {
      this.inChamber = true;
      this.fireActive = false;
      this.chamberDoor.close();
      this.fireLoop?.setVolume(0, 1);
      this.objective = 'Bring the three stabiliser pylons online';
      game.say('Reactor chamber. Bring the three stabilisers online — they are on the raised platforms around the core.');
      this.checkpoint.position.set(0, 0, -101);
      this.checkpoint.yaw = 0;
    }

    // Core shader state.
    const instability = this.sealed ? 0 : Math.min(1, 0.45 + (1 - this.timeLeft / this.timeLimit) * 0.5 - this.pylonsOnline * 0.12);
    const cu = this.coreMat.uniforms;
    cu.uTime.value = t;
    cu.uInstability.value = THREE.MathUtils.lerp(cu.uInstability.value, instability, 1 - Math.exp(-dt * 2));
    if (this.sealed) {
      this.sealTime += dt;
      cu.uSealed.value = Math.min(1, this.sealTime / 2.5);
      this.coreLight.color.lerpColors(_orange, _cyan, cu.uSealed.value);
    }
    const co = this.coronaMat.uniforms;
    co.uTime.value = t;
    co.uInstability.value = cu.uInstability.value;
    co.uSealed.value = cu.uSealed.value;
    this.coreGroup.rotation.y += dt * 0.25;
    this.coreLight.intensity = 200 + Math.sin(t * (4 + instability * 10)) * 40 * (1 - cu.uSealed.value);
    for (const r of this.coreRings) {
      if (r.locked) {
        r.pivot.rotation.x = THREE.MathUtils.lerp(r.pivot.rotation.x, Math.PI / 2, 1 - Math.exp(-dt * 2));
        r.pivot.rotation.z += dt * 0.3;
      } else {
        r.pivot.rotation.x += dt * r.speed;
        r.pivot.rotation.y += dt * r.speed * 0.7;
      }
    }
    for (const py of this.pylons) {
      py.holo.uniforms.uTime.value = t;
      py.holo.uniforms.uOpacity.value = THREE.MathUtils.lerp(py.holo.uniforms.uOpacity.value, py.online ? 0.9 : 0, 1 - Math.exp(-dt * 3));
    }

    // Bridge.
    if (this.pylonsOnline === 3 && this.bridge.extend < 1) {
      this.bridge.extend = Math.min(1, this.bridge.extend + dt * 0.5);
      this.bridge.mesh.scale.z = Math.max(0.001, this.bridge.extend);
      this.bridge.mesh.position.z = CORE.z + 2 + 4.1 * this.bridge.extend / 2 + (1 - this.bridge.extend) * 4.1;
      this.bridge.collider.enabled = this.bridge.extend > 0.95;
    }

    // Plasma flares while the pylons are being activated.
    if (this.inChamber && !this.sealed) {
      this.flareTimer -= dt;
      if (this.flareTimer <= 0) {
        this.flareTimer = Math.max(1.6, 3.6 - this.pylonsOnline * 0.6) * (0.8 + Math.random() * 0.4);
        const f = this.flares.find((k) => k.state === 'idle');
        if (f) {
          f.state = 'warn';
          f.t = 0;
          // Aim slightly ahead of where the player is moving.
          f.pos.set(p.x + player.body.velocity.x * 0.5, p.y, p.z + player.body.velocity.z * 0.5);
          f.warn.position.set(f.pos.x, f.pos.y + 0.04, f.pos.z);
          f.warn.visible = true;
        }
      }
    }
    for (const f of this.flares) {
      if (f.state === 'idle') continue;
      f.t += dt;
      f.colMat.uniforms.uTime.value = t;
      if (f.state === 'warn') {
        f.warn.material.opacity = 0.4 + 0.5 * Math.abs(Math.sin(f.t * 12));
        if (f.t > 1.1) {
          f.state = 'fire';
          f.t = 0;
          f.column.visible = true;
          f.column.position.set(f.pos.x, f.pos.y + 7, f.pos.z);
          audio.play('surge', { position: f.pos });
          player.addShake(0.25);
        }
      } else if (f.state === 'fire') {
        f.colMat.uniforms.uIntensity.value = Math.sin(Math.min(1, f.t / 0.7) * Math.PI);
        const d = Math.hypot(p.x - f.pos.x, p.z - f.pos.z);
        if (d < 1.5 && f.t < 0.6) player.damage(28, f.pos, 7, 'Engulfed by a plasma flare');
        if (f.t > 0.7) {
          f.state = 'idle';
          f.warn.visible = false;
          f.column.visible = false;
        }
      }
    }
  }

  hints() {
    if (!this.inChamber) {
      const p = this.game.player.position;
      if (p.z > -40) return ['Keep moving — the fire wall is behind you.', 'Red rings on the floor show where debris will land. Step out of them.'];
      if (p.z > -68.5) return ['Jump across the platforms. Ride the moving platform.', 'The big gap needs the thrusters: jump, then press Space again at the top of the arc.'];
      return ['The pistons slam in a rolling sequence. Wait for one to rise, then dash under it.', 'Stand between pistons only on the marked-free floor — not under a hazard stripe.'];
    }
    if (this.pylonsOnline < 3) {
      return [
        'Stabilisers are on the raised platforms west, east and north of the core.',
        'Use the stepping blocks to climb up. Keep moving — the plasma flares target where you are heading.',
        'Hold E at a pylon for 1.5 seconds to bring it online.'
      ];
    }
    return ['Cross the extended bridge on the south side of the pit and hold E at the sealing console.'];
  }

  objectiveText() {
    if (this.inChamber && this.pylonsOnline < 3) return `Bring the stabilisers online (${this.pylonsOnline}/3)`;
    return this.objective;
  }
}

const _orange = new THREE.Color(0xff6a20);
const _cyan = new THREE.Color(0x37c8ff);
