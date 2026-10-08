// LEVEL 1 — CORRIDORS (Explore)
//
// The station's maintenance deck after the power failure. Pitch dark apart
// from red emergency lighting and SPARK's flashlight. The player explores four
// connected areas to recover three reactor keycards:
//   RED  — Crew Quarters: find it in the dark, and find the coolant door code
//          painted in UV ink that only the flashlight reveals (custom shader).
//   BLUE — Storage Bay: climb crates and a broken catwalk (3D platforming).
//   GOLD — Coolant Pumps: behind the keypad door, through a steam-vent gauntlet.
// What only this level has: darkness + flashlight battery management, the
// hidden-ink code and keypad puzzle, and the scanner ping.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Level } from '../level.js';
import { Door, Keycard, SteamVent, Terminal, Pickup, makeSign, emissive } from '../objects/common.js';
import { textures, makeLabelTexture } from '../../engine/textures.js';
import { createUvInkMaterial, createHologramMaterial } from '../../shaders/effects.js';
import { audio } from '../../engine/audio.js';
import { makeZone, pointInBox } from '../../engine/physics.js';

const CELL = 2;
const COLS = 32;
const ROWS = 30;
const edgeX = (c) => c * CELL - 30;
const edgeZ = (r) => r * CELL - 50;

const LOGS = {
  dock: {
    id: 'LOG 07-A',
    title: 'Unit activation record',
    body: 'Maintenance unit SPARK-07 reactivated on emergency power.\n\nStation status: REACTOR CORE TEMPERATURE CRITICAL. Crew evacuated to lifeboats at 03:12.\n\nDirective from ARIA: recover the three reactor keycards (red, blue, gold), descend to the control room, and stabilise the core.'
  },
  crew: {
    id: 'LOG 11-C',
    title: 'Mira Okafor — personal log',
    body: "They changed the coolant pump door code again. I'm not memorising another four digits.\n\nI painted it on the wall above my bunk in the UV marker from the lab — invisible unless you shine a light on it. Chief would kill me.\n\nIf you're reading this, I hope the lights are still on. They never are."
  },
  storage: {
    id: 'LOG 14-S',
    title: 'Cargo manifest — Storage Bay 2',
    body: 'Keycard BLUE secured in the high rack, east wall, per security protocol.\n\nThe catwalk section above row 3 collapsed last week. Engineering says "just jump it".\n\nThe steam relief line on the catwalk vents every few seconds. Wait for it.'
  },
  hall: {
    id: 'LOG 02-R',
    title: 'Chief Engineer Vasquez',
    body: 'Core temperature passing 2,800 K. Containment field at 61%.\n\nThe reactor access lift needs all three keycards — red, blue and gold. Once you are down there, the control room has to re-route power through the junctions in order of load, lowest first, or the breakers will trip.\n\nGood luck to whoever finds this.'
  }
};

export class Level1 extends Level {
  static meta = {
    number: 1,
    name: 'CORRIDORS',
    verb: 'EXPLORE',
    tagline: 'The power is out. Find three keycards in the dark.',
    music: 'level1'
  };

  build() {
    const game = this.game;
    this.keycards = [];
    this.cardsInserted = 0;
    this.code = String(1000 + Math.floor(Math.random() * 9000)).split('');
    this.coolantUnlocked = false;
    this.exitOpen = false;
    this.batteryDrain = 0.9;

    // --------------------------------------------------------- materials --
    this.mat = {
      wall: this.standardSet('panels', 1, { color: 0x8c98a6, metalness: 0.55 }),
      floor: this.standardSet('floor', 1, { color: 0x9aa0a8, metalness: 0.6 }),
      ceiling: this.standardSet('ceiling', 1, { color: 0x666c74, emissive: 0xbfe8ff, emissiveIntensity: 0.0, metalness: 0.4 }),
      hazard: this.standardSet('hazard', 1, { roughness: 0.6 }),
      crate: new THREE.MeshStandardMaterial({ ...textures.set('panels'), color: 0x8a6a3a, metalness: 0.3, roughness: 0.7 }),
      crateBlue: new THREE.MeshStandardMaterial({ ...textures.set('panels'), color: 0x2f5a8a, metalness: 0.4, roughness: 0.6 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x272d35, metalness: 0.8, roughness: 0.4 }),
      pipe: new THREE.MeshStandardMaterial({ color: 0x59626e, metalness: 0.9, roughness: 0.3, ...textures.brushed(), bumpScale: 0.5 }),
      grate: new THREE.MeshStandardMaterial({ ...textures.grate(), color: 0x7d8691, metalness: 0.8, roughness: 0.4, alphaTest: 0.5, side: THREE.DoubleSide }),
      fabric: new THREE.MeshStandardMaterial({ color: 0x3b4a5c, roughness: 0.95 }),
      redGlow: emissive(0xff2a1a, 3),
      cyanGlow: emissive(0x37c8ff, 3),
      greenGlow: emissive(0x37ff8b, 3)
    };
    this.mat.grate.userData.noShadow = false;

    this.buildGrid();
    this.buildDock();
    this.buildCorridor();
    this.buildCrewQuarters();
    this.buildStorage();
    this.buildHall();
    this.buildCoolant();
    this.buildLift();
    this.buildLights();
    this.finalizeStatic();

    // Static skybox (cube map) visible through the dock's viewport window.
    game.scene.background = textures.starCube();
    game.scene.fog = new THREE.FogExp2(0x05080c, 0.035);
    game.scene.environmentIntensity = 0.12;

    this.checkpoint.position.set(0, 0, 2);
    this.checkpoint.yaw = 0;
    this.objective = 'Find the three reactor keycards';

    this.cinematic = {
      duration: 7,
      points: [
        new THREE.Vector3(0, 3.0, -38), new THREE.Vector3(-4, 2.6, -28),
        new THREE.Vector3(1, 2.2, -14), new THREE.Vector3(0, 1.6, -3), new THREE.Vector3(0, 1.05, 2)
      ],
      targets: [
        new THREE.Vector3(0, 1.5, -44), new THREE.Vector3(0, 1.2, -36),
        new THREE.Vector3(0, 1.0, -24), new THREE.Vector3(0, 1.0, -10), new THREE.Vector3(0, 1.0, -6)
      ]
    };
  }

  // ---------------------------------------------------------------- layout --
  buildGrid() {
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('#'));
    const carve = (c0, r0, c1, r1, ch = '.') => {
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) grid[r][c] = ch;
    };
    carve(13, 1, 16, 2); // lift
    carve(14, 3, 15, 3); // exit door
    carve(9, 4, 20, 8); // reactor access hall
    carve(8, 5, 8, 6); // coolant door
    carve(1, 2, 7, 9); // coolant pumps
    carve(14, 9, 15, 21); // main corridor
    carve(9, 13, 13, 14); // crew branch
    carve(8, 13, 8, 14); // crew door
    carve(2, 11, 7, 18); // crew quarters
    carve(16, 17, 20, 18); // storage branch
    carve(21, 17, 21, 18); // storage door
    carve(22, 10, 30, 24, ','); // storage bay (tall)
    carve(11, 22, 18, 27); // maintenance dock
    this.grid = grid;

    // Greedy meshing: merge runs of identical cells into large boxes.
    const merge = (match, emit) => {
      const used = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (used[r][c] || !match(grid[r][c])) continue;
          const ch = grid[r][c];
          let w = 1;
          while (c + w < COLS && !used[r][c + w] && grid[r][c + w] === ch) w++;
          let h = 1;
          outer: while (r + h < ROWS) {
            for (let k = 0; k < w; k++) if (used[r + h][c + k] || grid[r + h][c + k] !== ch) break outer;
            h++;
          }
          for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) used[rr][cc] = true;
          emit(c, r, w, h, ch);
        }
      }
    };

    const WALL_H = 8.4;
    merge((ch) => ch === '#', (c, r, w, h) => {
      // Skip wall blocks that touch no open cell (fully buried) to save triangles.
      let exposed = false;
      for (let rr = r - 1; rr <= r + h && !exposed; rr++) {
        for (let cc = c - 1; cc <= c + w && !exposed; cc++) {
          if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && grid[rr][cc] !== '#') exposed = true;
        }
      }
      const x = edgeX(c) + (w * CELL) / 2;
      const z = edgeZ(r) + (h * CELL) / 2;
      if (exposed) this.box(w * CELL, WALL_H, h * CELL, x, WALL_H / 2 - 0.2, z, this.mat.wall, { tile: 2 });
    });
    merge((ch) => ch !== '#', (c, r, w, h, ch) => {
      const x = edgeX(c) + (w * CELL) / 2;
      const z = edgeZ(r) + (h * CELL) / 2;
      const ceil = ch === ',' ? 8 : 3.6;
      this.box(w * CELL, 0.4, h * CELL, x, -0.2, z, this.mat.floor, { tile: 2 });
      this.box(w * CELL, 0.3, h * CELL, x, ceil + 0.15, z, this.mat.ceiling, { tile: 4, minimap: false });
    });
  }

  // Wall-mounted emergency light fixture with a real point light.
  emergencyLight(x, y, z, color, intensity = 6, distance = 10, flicker = 0) {
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.25), emissive(color, 4));
    fixture.position.set(x, y, z);
    this.add(fixture);
    const light = new THREE.PointLight(color, intensity, distance, 1.8);
    light.position.set(x, y - 0.25, z);
    this.add(light);
    if (flicker > 0) {
      const base = intensity;
      let next = 0;
      this.addUpdatable((dt, t) => {
        if (t > next) {
          next = t + 0.05 + Math.random() * (Math.random() < flicker ? 0.1 : 1.5);
          const on = Math.random() > flicker * 0.5;
          light.intensity = on ? base * (0.7 + Math.random() * 0.3) : base * 0.08;
          fixture.material.emissiveIntensity = on ? 4 : 0.3;
        }
      });
    }
    return light;
  }

  crate(x, z, w, h, d, mat = this.mat.crate, y = 0) {
    this.box(w, h, d, x, y + h / 2, z, mat, { tile: 1.6 });
    // Hazard banding on the crate edges.
    this.box(w + 0.02, 0.12, d + 0.02, x, y + h - 0.12, z, this.mat.hazard, { collide: false, tile: 1 });
  }

  pipeRun(x0, y, z0, x1, z1, radius = 0.12) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 12), this.mat.pipe);
    pipe.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    pipe.rotation.z = Math.PI / 2;
    pipe.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    this.addStaticMesh(pipe);
  }

  // ------------------------------------------------------------------ dock --
  buildDock() {
    // Charging pod behind the spawn point.
    const pod = new THREE.Group();
    pod.position.set(0, 0, 4.6);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 12, 40), this.mat.cyanGlow);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    const back = new THREE.Mesh(new RoundedBoxGeometry(2.2, 2.6, 0.4, 3, 0.1), this.mat.dark);
    back.position.set(0, 1.3, 1.0);
    const holo = createHologramMaterial(0x37c8ff, 0.35);
    const field = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 32, 1, true), holo);
    field.position.y = 1.1;
    pod.add(ring, back, field);
    this.add(pod);
    this.physics.addCentered(0, 1.3, 5.6, 2.2, 2.6, 0.4);
    this.addUpdatable((dt, t) => { holo.uniforms.uTime.value = t; });

    // Viewport window showing the static star skybox.
    const windowFrame = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshBasicMaterial({ color: 0x000000, colorWrite: false }));
    windowFrame.position.set(-7.86, 1.9, 0);
    windowFrame.rotation.y = Math.PI / 2;
    windowFrame.renderOrder = -1;
    this.add(windowFrame);
    this.dockWindow = windowFrame;
    // Glass pane with environment reflection, and a frame.
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshPhysicalMaterial({
      color: 0x88aacc, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.12,
      envMap: textures.starCube(), envMapIntensity: 1.5
    }));
    glass.position.set(-7.84, 1.9, 0);
    glass.rotation.y = Math.PI / 2;
    this.add(glass);
    for (const [y, h] of [[0.85, 0.12], [2.95, 0.12]]) this.box(0.2, h, 6.2, -7.9, y, 0, this.mat.dark, { collide: false });

    this.crate(5.5, -3.5, 1.6, 1.2, 1.6);
    this.crate(6.2, -1.6, 1.2, 0.8, 1.2, this.mat.crateBlue);
    this.crate(-5.6, -4.6, 1.4, 1.4, 1.4);

    makeSign(this, 'MAINTENANCE DOCK 07', { x: 0, y: 3.0, z: 5.95, rotationY: Math.PI, width: 3.4, height: 0.5 });
    makeSign(this, '▲ REACTOR ACCESS', { x: 0, y: 3.1, z: -5.9 + 0.05, width: 2.6, height: 0.42, color: '#ff8a3a' });
    this.terminals = [new Terminal(this, { x: -6, z: 2.5, rotationY: Math.PI / 2, log: LOGS.dock })];
  }

  // -------------------------------------------------------------- corridor --
  buildCorridor() {
    // Pipes and conduits along both walls.
    for (const x of [-1.85, 1.85]) {
      this.pipeRun(x, 3.1, -32, x, -6, 0.1);
      this.pipeRun(x * 0.97, 2.85, -32, x * 0.97, -6, 0.07);
    }
    // Hazard floor strips at the vent zones.
    for (const z of [-10, -18]) this.box(4, 0.02, 0.25, 0, 0.01, z + 1.6, this.mat.hazard, { collide: false });

    // Floor vents (pairs fire together — time your run between bursts).
    this.vents = [];
    for (const [z, offset] of [[-10, 0], [-18, 1.6]]) {
      for (const x of [-1.0, 1.0]) {
        this.vents.push(new SteamVent(this, { position: new THREE.Vector3(x, 0.02, z), period: 3.6, burst: 1.3, offset, radius: 0.95, length: 3.2, silent: x > 0 }));
      }
    }
    // Horizontal pipe leak at chest height: crouch (C) to pass under it.
    this.pipeVent = new SteamVent(this, {
      position: new THREE.Vector3(-1.95, 1.35, -27),
      direction: new THREE.Vector3(1, 0, 0), length: 4.4, period: 4.2, burst: 3.2, offset: 0.5, radius: 0.32, size: 1.0, growth: 0.03
    });
    this.vents.push(this.pipeVent);
    this.box(0.4, 0.4, 0.4, -1.95, 1.35, -27, this.mat.pipe, { collide: false });
    this.box(4, 0.02, 0.25, 0, 0.01, -25.6, this.mat.hazard, { collide: false });
    makeSign(this, '⚠ STEAM LEAK — CROUCH [C]', { x: 1.98, y: 2.3, z: -24.8, rotationY: -Math.PI / 2, width: 2.6, height: 0.36, color: '#ffb020' });

    this.sideDoors = [
      new Door(this, { x: -13, z: -22, width: 3.6, height: 3.0, rotationY: Math.PI / 2, locked: false, label: 'CREW QUARTERS' }),
      new Door(this, { x: 13, z: -14, width: 3.6, height: 3.0, rotationY: Math.PI / 2, locked: false, label: 'STORAGE BAY 2' })
    ];
    makeSign(this, '◀ CREW QUARTERS', { x: -1.98, y: 2.4, z: -18.5, rotationY: Math.PI / 2, width: 2.2, height: 0.36 });
    makeSign(this, 'STORAGE BAY ▶', { x: 1.98, y: 2.4, z: -10.6, rotationY: -Math.PI / 2, width: 2.2, height: 0.36 });

    // Flickering ceiling fixtures (emissive only — the power is mostly dead).
    for (const z of [-9, -17, -23, -30]) {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.3), emissive(0xcfeeff, 0));
      fixture.position.set(0, 3.42, z);
      this.add(fixture);
      let next = Math.random() * 3;
      this.addUpdatable((dt, t) => {
        if (t > next) {
          const burst = Math.random() < 0.3;
          fixture.material.emissiveIntensity = burst ? 3 + Math.random() * 3 : 0.05;
          next = t + (burst ? 0.04 + Math.random() * 0.08 : 0.5 + Math.random() * 3);
        }
      });
    }
  }

  // --------------------------------------------------------- crew quarters --
  buildCrewQuarters() {
    // Bunks along the north and south walls.
    for (const z of [-26.9, -13.1]) {
      for (const x of [-24, -20.5, -17]) {
        // Leave a gap under Mira's UV-ink code on the north wall.
        if (z < -20 && x === -20.5) continue;
        const zz = z;
        this.box(2.4, 0.5, 1.6, x, 0.45, zz, this.mat.dark, { tile: 1 });
        this.box(2.3, 0.15, 1.5, x, 0.78, zz, this.mat.fabric, { collide: false });
        this.box(2.4, 0.12, 1.6, x, 2.0, zz, this.mat.dark, { minimap: false });
        this.box(2.3, 0.15, 1.5, x, 2.13, zz, this.mat.fabric, { collide: false });
        for (const px of [x - 1.15, x + 1.15]) this.box(0.1, 2.3, 0.1, px, 1.15, zz + (zz < -20 ? 0.75 : -0.75), this.mat.pipe, { collide: false });
      }
    }
    // Lockers along the west wall, one toppled over.
    for (let i = 0; i < 5; i++) {
      const z = -24 + i * 1.1;
      if (i === 2) continue;
      this.box(0.7, 2.2, 1.0, -25.6, 1.1, z, this.mat.crateBlue, { tile: 1 });
    }
    this.box(2.2, 0.7, 1.0, -23.6, 0.35, -21.6, this.mat.crateBlue, { tile: 1, rotationY: 0 });
    // Desk with the RED keycard.
    this.box(2.2, 0.08, 1.0, -18, 0.95, -19.5, this.mat.dark, { tile: 1 });
    for (const [dx, dz] of [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]]) this.box(0.08, 0.95, 0.08, -18 + dx, 0.47, -19.5 + dz, this.mat.pipe, { collide: false });
    this.physics.addCentered(-18, 0.5, -19.5, 2.2, 1.0, 1.0);

    this.keycards.push(new Keycard(this, {
      position: new THREE.Vector3(-18, 0.99, -19.5), color: 0xff3344, name: 'RED',
      onCollect: (k) => this.cardCollected(k)
    }));

    // The coolant door code, painted in UV ink above the bunks on the north wall.
    // Invisible unless the flashlight cone falls on it — see shaders/effects.js.
    const inkCanvas = document.createElement('canvas');
    inkCanvas.width = 1024;
    inkCanvas.height = 384;
    const ctx = inkCanvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.font = 'italic 700 64px "Rajdhani", sans-serif';
    ctx.fillText('COOLANT DOOR ->', 60, 90);
    ctx.font = '700 200px "Rajdhani", sans-serif';
    ctx.save();
    ctx.translate(90, 300);
    ctx.rotate(-0.04);
    ctx.fillText(this.code.join(' '), 0, 0);
    ctx.restore();
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(500, 230, 470, 150, -0.03, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'italic 600 46px "Rajdhani", sans-serif';
    ctx.fillText("- M. (don't tell chief)", 600, 360);
    const inkTex = new THREE.CanvasTexture(inkCanvas);
    this.uvInk = createUvInkMaterial(inkTex);
    const ink = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.3), this.uvInk);
    ink.position.set(-20.5, 2.85, -27.95);
    this.add(ink);
    this.inkPosition = ink.position.clone();
    this.codeSeen = false;

    this.terminals.push(new Terminal(this, { x: -15.5, z: -15, rotationY: -Math.PI / 2, log: LOGS.crew }));
    this.pickups = [new Pickup(this, { position: new THREE.Vector3(-25, 1.0, -14.5), kind: 'battery' })];
    makeSign(this, 'CREW QUARTERS — DECK C', { x: -14.05, y: 3.0, z: -17.5, rotationY: -Math.PI / 2, width: 2.6, height: 0.4 });
  }

  // ---------------------------------------------------------- storage bay --
  buildStorage() {
    // Racks along the east wall.
    for (let z = -2; z > -22; z -= 4.2) {
      this.box(1.6, 0.12, 3.8, 31, 1.5, z, this.mat.dark, { tile: 1 });
      this.box(1.6, 0.12, 3.8, 31, 3.0, z, this.mat.dark, { tile: 1 });
      this.box(1.6, 0.12, 3.8, 31, 4.5, z, this.mat.dark, { tile: 1, minimap: false });
      this.crate(31, z - 0.9, 1.2, 1.0, 1.2, this.mat.crate, 1.56);
      this.crate(31, z + 1.0, 1.2, 0.8, 1.0, this.mat.crateBlue, 3.06);
      this.box(1.6, 4.6, 0.12, 31, 2.3, z + 1.9, this.mat.pipe, { tile: 1 });
    }
    // Ground clutter.
    this.crate(17.5, -6, 2, 1.6, 2);
    this.crate(20.5, -4, 1.4, 1.0, 1.4, this.mat.crateBlue);
    this.crate(25, -9, 2, 2, 2);
    this.crate(26.5, -11.5, 1.4, 1.2, 1.4);

    // Climbing route: crates of rising height to the south catwalk.
    this.crate(18, -20, 1.6, 1.0, 1.6);
    this.crate(20, -22.4, 1.6, 2.0, 1.6, this.mat.crateBlue);
    this.crate(21.6, -25.2, 1.8, 3.0, 1.8);
    // Catwalk along the south wall at 3.6 m — with a collapsed section to jump.
    const catwalkY = 3.6;
    const segments = [[16, 23.4], [25.6, 31.9]];
    for (const [x0, x1] of segments) {
      const w = x1 - x0;
      this.box(w, 0.1, 2, (x0 + x1) / 2, catwalkY - 0.05, -29, this.mat.grate, { tile: 1 });
      for (let x = x0 + 0.5; x < x1; x += 2) this.box(0.12, catwalkY - 0.1, 0.12, x, (catwalkY - 0.1) / 2, -28.1, this.mat.pipe, { collide: false });
      this.box(w, 0.08, 0.06, (x0 + x1) / 2, catwalkY + 1.0, -29.95, this.mat.pipe, { collide: false });
    }
    makeSign(this, '⚠ CATWALK COLLAPSED', { x: 24.5, y: 5.0, z: -29.95, width: 2.6, height: 0.36, color: '#ffb020' });
    // Relief vent blasting across the far catwalk.
    this.vents.push(new SteamVent(this, {
      position: new THREE.Vector3(28, 7.9, -29), direction: new THREE.Vector3(0, -1, 0),
      length: 4.4, period: 3.2, burst: 1.2, offset: 0.4, radius: 0.85
    }));
    // Tower at the east end with the BLUE keycard.
    this.crate(30.4, -26.4, 2.2, 4.4, 2.2, this.mat.crateBlue);
    this.keycards.push(new Keycard(this, {
      position: new THREE.Vector3(30.4, 4.4, -26.4), color: 0x3a8bff, name: 'BLUE',
      onCollect: (k) => this.cardCollected(k)
    }));
    // A shaft of cold light from a ceiling hatch.
    this.storageSpot = new THREE.SpotLight(0x9fc8ff, 90, 14, 0.5, 0.6, 1.5);
    this.storageSpot.position.set(24, 7.9, -18);
    this.storageSpot.target.position.set(22, 0, -22);
    this.add(this.storageSpot);
    this.add(this.storageSpot.target);
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(2, 0.05, 2), emissive(0xcfe6ff, 2));
    hatch.position.set(24, 7.98, -18);
    this.add(hatch);

    this.terminals.push(new Terminal(this, { x: 16, z: -9, rotationY: Math.PI / 2, log: LOGS.storage }));
    this.pickups.push(new Pickup(this, { position: new THREE.Vector3(26.5, 2.0, -11.5), kind: 'battery' }));
    makeSign(this, 'STORAGE BAY 2', { x: 14.06, y: 3.2, z: -18, rotationY: Math.PI / 2, width: 2.4, height: 0.42 });
  }

  // ------------------------------------------------------- reactor hall --
  buildHall() {
    this.exitDoor = new Door(this, { x: 0, z: -43, width: 3.8, height: 3.2, locked: true, color: 0xff8a3a, label: 'REACTOR ACCESS' });
    this.coolantDoor = new Door(this, { x: -13, z: -38, width: 3.6, height: 3.0, rotationY: Math.PI / 2, locked: true, label: 'COOLANT PUMPS' });

    // Card reader with three slots beside the exit door.
    const reader = new THREE.Group();
    reader.position.set(3.0, 1.35, -41.8);
    reader.add(new THREE.Mesh(new RoundedBoxGeometry(0.8, 1.0, 0.2, 2, 0.04), this.mat.dark));
    this.slotMats = [];
    const slotColors = [0xff3344, 0x3a8bff, 0xffc83a];
    for (let i = 0; i < 3; i++) {
      const m = emissive(0x333333, 0.3);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.05), m);
      slot.position.set(0, 0.3 - i * 0.28, 0.11);
      reader.add(slot);
      this.slotMats.push({ m, color: slotColors[i] });
    }
    this.add(reader);
    this.addInteractable({
      position: new THREE.Vector3(1.5, 1.3, -41.6),
      radius: 2.6,
      prompt: () => {
        const n = this.collectedCount();
        return n < 3 ? `Card reader — ${n}/3 keycards` : 'Insert keycards';
      },
      enabled: () => !this.exitOpen,
      onInteract: () => this.tryExit()
    });

    // Keypad beside the coolant door.
    const keypad = new THREE.Group();
    keypad.position.set(-11.92, 1.45, -35.4);
    keypad.rotation.y = Math.PI / 2;
    keypad.add(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.7, 0.12, 2, 0.03), this.mat.dark));
    this.keypadScreen = makeLabelTexture('LOCKED', { width: 256, height: 96, color: '#ff4455', border: '#ff4455', font: '700 40px Orbitron, sans-serif' });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), new THREE.MeshBasicMaterial({ map: this.keypadScreen, toneMapped: false }));
    screen.position.set(0, 0.2, 0.065);
    keypad.add(screen);
    for (let i = 0; i < 12; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.03), emissive(0x37c8ff, 0.8));
      b.position.set(-0.12 + (i % 3) * 0.12, 0.02 - Math.floor(i / 3) * 0.1, 0.07);
      keypad.add(b);
    }
    this.add(keypad);
    this.addInteractable({
      position: new THREE.Vector3(-11.6, 1.4, -35.6),
      radius: 2.4,
      prompt: 'Use keypad',
      enabled: () => !this.coolantUnlocked,
      onInteract: () => this.openKeypad()
    });

    // Rotating amber beacon — a moving spot light sweeping the hall.
    const beacon = new THREE.Group();
    beacon.position.set(0, 3.45, -37);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), emissive(0xff8a1a, 1.4));
    dome.rotation.x = Math.PI;
    beacon.add(dome);
    this.beaconSpot = new THREE.SpotLight(0xff8a1a, 70, 18, 0.35, 0.5, 1.6);
    this.beaconSpot.position.set(0, 0, 0);
    const beaconTarget = new THREE.Object3D();
    beaconTarget.position.set(4, -2.5, 0);
    beacon.add(this.beaconSpot, beaconTarget);
    this.beaconSpot.target = beaconTarget;
    this.add(beacon);
    this.addUpdatable((dt) => { beacon.rotation.y += dt * 2.4; });

    this.terminals.push(new Terminal(this, { x: 8.5, z: -33.4, rotationY: Math.PI, log: LOGS.hall }));
    this.pickups.push(new Pickup(this, { position: new THREE.Vector3(10.5, 1.0, -40.5), kind: 'repair' }));
    for (const x of [-9, 9]) this.crate(x, -40.5, 1.6, 1.2, 1.6);
    makeSign(this, 'COOLANT PUMPS', { x: -11.95, y: 3.1, z: -38, rotationY: Math.PI / 2, width: 2.2, height: 0.38, color: '#ffc83a' });

    this.addMarker(this.exitDoor.group, '#ff8a3a', 'door');
    this.addMarker(this.coolantDoor.group, '#ffc83a', 'door');
    this.addScanTarget(new THREE.Vector3(-11.6, 1.4, -35.6), 'KEYPAD', '#ffc83a', () => !this.coolantUnlocked);
    this.addScanTarget(new THREE.Vector3(-20.5, 2.75, -27.6), 'UV PAINT?', '#b46bff', () => !this.codeSeen);
  }

  // ---------------------------------------------------------- coolant room --
  buildCoolant() {
    // Coolant tanks in the far corners (curved capsule surfaces, brushed metal).
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x6d7a88, metalness: 0.85, roughness: 0.28, ...textures.brushed(), bumpScale: 0.4 });
    for (const z of [-44.6, -31.4]) {
      const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 1.6, 6, 20), tankMat);
      tank.position.set(-26.8, 1.7, z);
      tank.castShadow = tank.receiveShadow = true;
      this.add(tank);
      this.physics.addCentered(-26.8, 1.7, z, 1.8, 3.4, 1.8);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.05, 8, 32), emissive(0x37c8ff, 2));
      band.rotation.x = Math.PI / 2;
      band.position.set(-26.8, 1.7, z);
      this.add(band);
    }
    // Vent gauntlet: four wall-to-wall curtains of floor vents. Each curtain
    // fires 0.85 s after the previous one, so a wave rolls away from the door
    // and the player has to follow just behind it.
    const cols = [-16.6, -19.2, -21.8, -24.4];
    cols.forEach((x, ci) => {
      for (let z = -44.9, k = 0; z <= -31; z += 2.2, k++) {
        this.vents.push(new SteamVent(this, {
          position: new THREE.Vector3(x, 0.02, z), period: 3.4, burst: 1.1, offset: -ci * 0.85,
          radius: 1.15, length: 3.4, silent: k !== 3
        }));
      }
      this.box(0.25, 0.02, 16, x + 1.45, 0.01, -38, this.mat.hazard, { collide: false, tile: 1 });
    });
    // Raised pedestal with the GOLD keycard.
    this.box(2.4, 0.5, 2.4, -26.6, 0.25, -38, this.mat.dark, { tile: 1 });
    this.box(2.5, 0.06, 2.5, -26.6, 0.5, -38, this.mat.hazard, { collide: false, tile: 1 });
    this.keycards.push(new Keycard(this, {
      position: new THREE.Vector3(-26.6, 0.5, -38), color: 0xffc83a, name: 'GOLD',
      onCollect: (k) => this.cardCollected(k)
    }));
    this.pickups.push(new Pickup(this, { position: new THREE.Vector3(-15.2, 1.0, -44.6), kind: 'battery' }));
  }

  // ------------------------------------------------------------------ lift --
  buildLift() {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.85, 48), this.mat.greenGlow);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.02, -46);
    this.add(ring);
    this.liftHolo = createHologramMaterial(0x37ff8b, 0.4);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.4, 40, 1, true), this.liftHolo);
    column.position.set(0, 1.7, -46);
    this.add(column);
    makeSign(this, 'SERVICE LIFT ▼ CONTROL', { x: 0, y: 3.1, z: -47.95, width: 3.2, height: 0.42, color: '#37ff8b' });
    this.liftZone = makeZone(-2.2, -1, -48, 2.2, 3, -44.6);
    this.addMarker(new THREE.Vector3(0, 0, -46), '#37ff8b', 'goal', { visible: () => this.exitOpen });
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0x3a4f70, 0x111116, 0.8);
    this.add(hemi);
    this.emergencyLight(-6, 3.3, -5.7, 0xff2a1a, 7, 11, 0.1);
    const pod = new THREE.PointLight(0x37c8ff, 6, 7, 1.8);
    pod.position.set(0, 1.2, 4.2);
    this.add(pod);
    this.emergencyLight(1.9, 3.2, -18, 0xff2a1a, 8, 13, 0.05);
    this.emergencyLight(-8, 3.3, -32.3, 0xff6a1a, 7, 12);
    this.emergencyLight(-14.3, 3.3, -20, 0xff2a1a, 6, 12, 0.35);
    this.emergencyLight(-14.3, 3.3, -42, 0xff7a2a, 8, 14);
    this.emergencyLight(0, 3.3, -47.7, 0x37ff8b, 6, 9);
  }

  // ------------------------------------------------------------- logic --
  collectedCount() {
    return this.keycards.filter((k) => k.collected).length;
  }

  cardCollected(card) {
    const n = this.collectedCount();
    const game = this.game;
    game.ui.toast(`${card.name} keycard recovered (${n}/3)`, card.color.getStyle());
    game.ui.setKeycards(this.keycards.map((k) => ({ color: '#' + k.color.getHexString(), have: k.collected })));
    if (n === 1) game.say('Keycard authenticated. Two more, SPARK. The Storage Bay and the Coolant Pumps are your best bets.');
    if (n === 2) game.say('Two of three. Core temperature is still climbing.');
    if (n === 3) {
      game.say('All three keycards. Get to the card reader at the reactor access door.');
      this.objective = 'Insert the keycards at the Reactor Access door';
    }
    // Checkpoint where the card was found.
    this.checkpoint.position.copy(game.player.position);
    this.checkpoint.yaw = game.player.yaw;
  }

  tryExit() {
    const n = this.collectedCount();
    if (n < 3) {
      audio.play('locked');
      this.game.ui.toast(`Access denied — ${3 - n} keycard${3 - n === 1 ? '' : 's'} missing`, '#ff4455');
      return;
    }
    this.exitOpen = true;
    this.game.player.rig.triggerReach();
    this.slotMats.forEach((s, i) => {
      this.after(0.25 * (i + 1), () => {
        s.m.emissive.set(s.color);
        s.m.emissiveIntensity = 4;
        audio.play('beep', { pitch: 1 + i * 0.25 });
      });
    });
    this.after(1.1, () => {
      this.exitDoor.open();
      this.game.say('Access granted. Take the service lift down to the control room.');
      this.objective = 'Take the service lift down';
    });
  }

  openKeypad() {
    this.game.openKeypad({
      onSubmit: (entry) => {
        if (entry === this.code.join('')) {
          this.coolantUnlocked = true;
          this.coolantDoor.open();
          this.keypadScreen.userData.redraw('OPEN', { color: '#37ff8b', border: '#37ff8b' });
          this.game.say('Coolant pump door unlocked. Watch the vents in there — they fire in waves.');
          this.checkpoint.position.set(-10, 0, -38);
          this.checkpoint.yaw = Math.PI / 2;
          return true;
        }
        return false;
      }
    });
  }

  start() {
    const game = this.game;
    game.ui.setKeycards(this.keycards.map((k) => ({ color: '#' + k.color.getHexString(), have: false })));
    game.say('SPARK, you are online. Main power is down and the reactor is overheating. Your flashlight is on F. Find the three reactor keycards.', 1);
    game.ui.hintPrompt('Press H at any time for a hint · Q pings the scanner');
  }

  update(dt) {
    super.update(dt);
    const game = this.game;
    const player = game.player;
    const t = this.time;

    for (const k of this.keycards) k.update(dt, t);
    for (const p of this.pickups) p.update(dt, t);
    for (const d of [...this.sideDoors, this.exitDoor, this.coolantDoor]) d.update(dt);

    // Side doors open automatically when SPARK approaches.
    for (const d of this.sideDoors) {
      if (!d.isOpen && player.position.distanceTo(d.group.position) < 4.5) d.open();
    }

    // Steam vents: damage + knockback when caught in a burst.
    for (const v of this.vents) {
      v.update(dt, t);
      if (v.hits(player.position, player.body.height)) {
        player.damage(22, v.position, 7, 'Scalded by a steam vent');
      }
    }

    // UV ink follows the flashlight exactly.
    const u = this.uvInk.uniforms;
    u.uTime.value = t;
    player.flashlight.getWorldPosition(u.uLightPos.value);
    player.lookDirection(u.uLightDir.value);
    u.uLightOn.value = player.flashlight.intensity / 110;
    u.uCosOuter.value = Math.cos(player.flashlight.angle);
    u.uCosInner.value = Math.cos(player.flashlight.angle * (1 - player.flashlight.penumbra));
    if (!this.codeSeen && player.flashlightOn) {
      const toInk = this.inkPosition.clone().sub(u.uLightPos.value);
      const dist = toInk.length();
      if (dist < 9 && toInk.normalize().dot(u.uLightDir.value) > 0.93) {
        this.codeSeen = true;
        game.stats.secrets++;
        game.say('UV ink! That must be the coolant door code. Memorise it.');
        audio.play('success');
      }
    }

    this.liftHolo.uniforms.uTime.value = t;
    if (this.exitOpen && !this.completed && pointInBox(player.position, this.liftZone)) {
      this.completed = true;
      game.completeLevel();
    }

    // The music grows tense when a vent is about to fire nearby.
    let danger = 0;
    for (const v of this.vents) {
      const d = v.position.distanceTo(player.position);
      if (d < 6 && v.state !== 'idle') danger = Math.max(danger, 1 - d / 6);
    }
    game.audio.setIntensity(danger);
  }

  hints() {
    const have = (name) => this.keycards.find((k) => k.name === name)?.collected;
    const list = [];
    if (!have('RED')) list.push(['The Crew Quarters are through the door on the west side of the main corridor.', 'The red keycard is on a desk in the middle of the Crew Quarters. Use your flashlight (F).']);
    if (!this.coolantUnlocked) list.push(['The coolant door code is hidden somewhere in the Crew Quarters.', 'Mira painted it in UV ink above the bunks on the north wall — shine your flashlight on it.', `The code is ${this.code.join(' ')}.`]);
    if (!have('BLUE')) list.push(['The blue keycard is high up in the Storage Bay (east side of the corridor).', 'Jump (Space) up the stack of crates to reach the catwalk on the south wall.', 'Jump the collapsed gap, wait out the steam vent, then hop onto the tall blue crate at the east end.']);
    if (this.coolantUnlocked && !have('GOLD')) list.push(['The gold keycard is at the far end of the Coolant Pumps room.', 'The vent curtains fire in a wave rolling away from the door. Wait for the first curtain to fire, then follow just behind the wave.']);
    if (this.collectedCount() === 3 && !this.exitOpen) list.push(['Use the card reader to the right of the Reactor Access door at the north end of the hall.']);
    if (this.exitOpen) list.push(['The service lift is through the open Reactor Access door — step into the green ring.']);
    return list[0] ?? ['Explore with the flashlight (F) and ping the scanner (Q) to reveal nearby items.'];
  }

  objectiveText() {
    if (this.collectedCount() < 3 && this.objective.startsWith('Find')) return `Find the reactor keycards (${this.collectedCount()}/3)`;
    return this.objective;
  }
}
