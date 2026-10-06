// LEVEL 2 — CONTROL ROOM (Solve)
//
// A circular two-tier control room under a glass dome. A countdown is running.
// Five power junctions (three on the floor, two on the upper ring catwalk)
// must be brought online in order of load, lowest first — but the panels are
// not standardised (kW / MW / GW), so the player has to compare units. A
// security turret sweeps the floor with a scanner beam; cover pillars block
// its line of sight. Once all five are live, the master console's routing
// grid (a pipe-rotation puzzle) must be solved to drop the force field to the
// reactor lift.
// What only this level has: a countdown, a stealth/timing hazard with
// line-of-sight, jump pads, a logic puzzle with mixed units, the routing grid.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Level } from '../level.js';
import { Terminal, Pickup, makeSign, emissive } from '../objects/common.js';
import { textures, makeLabelTexture } from '../../engine/textures.js';
import {
  createScannerMaterial, createWedgeGeometry, createEnergyFlowMaterial,
  createForceFieldMaterial, createNebulaSkyMaterial, createHologramMaterial
} from '../../shaders/effects.js';
import { createReactorCoreMaterial } from '../../shaders/reactorCore.js';
import { audio } from '../../engine/audio.js';
import { settings } from '../../engine/settings.js';
import { makeZone, pointInBox } from '../../engine/physics.js';

const R = 16; // room radius
const CATWALK_IN = 12.5;
const CATWALK_Y = 3.5;
const BEAM_RADIUS = 12.2;
const BEAM_HEIGHT = 2.3;
const BEAM_HALF = 0.24;
const CONSOLE_POS = new THREE.Vector3(0, 0, -10.6);

const LOGS = {
  security: {
    id: 'LOG 21-K',
    title: 'Security officer Ndlovu',
    body: 'The floor sentry is still running the lockdown sweep. It is dumb but it is fast — anything in the beam gets a shock.\n\nIt cannot see through the grey structural pillars. Duck behind one when the beam swings round.\n\nIt only watches the floor. The upper ring is out of its line of sight.'
  },
  power: {
    id: 'LOG 23-P',
    title: 'Power engineer — shift notes',
    body: 'Reminder for the new hires: the junction displays are NOT standardised. Three different contractors, three different units.\n\n1 GW = 1,000 MW.   1 MW = 1,000 kW.\n\nAlways restore from the lowest load to the highest, or the breakers trip and the whole sequence resets.'
  }
};

function formatLoad(mw, unit) {
  if (unit === 'kW') return `${(mw * 1000).toLocaleString('en-US')} kW`;
  if (unit === 'GW') return `${(mw / 1000).toFixed(2)} GW`;
  return `${mw} MW`;
}

export class Level2 extends Level {
  static meta = {
    number: 2,
    name: 'CONTROL ROOM',
    verb: 'SOLVE',
    tagline: 'Route power through the junctions — lowest load first — before time runs out.',
    music: 'level2'
  };

  build() {
    const game = this.game;
    this.batteryDrain = 0.3;
    this.timeLimit = 240 * settings.difficulty.timeScale;
    this.timeLeft = this.timeLimit;
    this.progress = 0; // junctions online in the correct order
    this.gridSolved = false;
    this.detection = 0;
    this.turretCooldown = 0;
    this.beamAngle = Math.PI * 0.5;

    this.mat = {
      wall: this.standardSet('panels', 1, { color: 0xb4c2d2, metalness: 0.5 }),
      floor: this.standardSet('floor', 1, { color: 0xaab2bc, metalness: 0.7, roughness: 0.5 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x252b33, metalness: 0.85, roughness: 0.35, ...textures.brushed(), bumpScale: 0.4 }),
      pillar: new THREE.MeshStandardMaterial({ ...textures.set('panels'), color: 0x7d8792, metalness: 0.6, roughness: 0.45 }),
      hazard: this.standardSet('hazard', 1, { roughness: 0.6 }),
      grate: new THREE.MeshStandardMaterial({ ...textures.grate(), color: 0x8d96a1, metalness: 0.85, roughness: 0.35, alphaTest: 0.5, side: THREE.DoubleSide }),
      cyan: emissive(0x37c8ff, 3),
      green: emissive(0x37ff8b, 3),
      amber: emissive(0xffb020, 3)
    };

    this.buildRoom();
    this.buildTurret();
    this.buildJunctions();
    this.buildConsole();
    this.buildCatwalkHazards();
    this.buildExit();
    this.finalizeStatic();

    // Dynamic skybox: a nebula shader sphere that follows the camera.
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), createNebulaSkyMaterial());
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.add(this.sky);
    game.scene.background = new THREE.Color(0x000000);
    game.scene.fog = new THREE.FogExp2(0x060a12, 0.012);
    game.scene.environmentIntensity = 0.55;

    this.checkpoint.position.set(0, 0, 13.6);
    this.checkpoint.yaw = 0;
    this.objective = 'Bring the five power junctions online';
    this.cinematic = {
      duration: 7,
      points: [
        new THREE.Vector3(0, 13, 6), new THREE.Vector3(-11, 7, -4), new THREE.Vector3(-8, 4, 9),
        new THREE.Vector3(-2, 2.2, 15), new THREE.Vector3(0, 1.05, 13.6)
      ],
      targets: [
        new THREE.Vector3(0, 0, -2), new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 1.5, -4),
        new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 1.05, 9)
      ]
    };
  }

  // ------------------------------------------------------------------ room --
  buildRoom() {
    const physics = this.physics;
    const gapHalf = Math.asin(2.3 / R);

    // Floor slab + reflective inner disc.
    physics.addBox(-R - 2, -0.4, -R - 10, R + 2, 0, R + 2, { minimap: false });
    const high = this.game.engine.quality.reflections;
    if (high) {
      const mirror = new Reflector(new THREE.CircleGeometry(CATWALK_IN, 64), {
        textureWidth: Math.round(window.innerWidth * 0.5),
        textureHeight: Math.round(window.innerHeight * 0.5),
        color: 0x7a8a99,
        clipBias: 0.003
      });
      mirror.rotation.x = -Math.PI / 2;
      mirror.position.y = 0.001;
      this.add(mirror);
    }
    const floorSet = textures.set('floor', 12, 12);
    const innerFloor = new THREE.Mesh(new THREE.CircleGeometry(CATWALK_IN, 64), new THREE.MeshStandardMaterial({
      ...floorSet, color: 0x9aa4ae, metalness: 0.75, roughness: high ? 0.35 : 0.3,
      transparent: high, opacity: high ? 0.78 : 1
    }));
    innerFloor.rotation.x = -Math.PI / 2;
    innerFloor.position.y = 0.01;
    innerFloor.receiveShadow = true;
    this.add(innerFloor);
    const outerFloor = new THREE.Mesh(new THREE.RingGeometry(CATWALK_IN - 0.01, R + 0.5, 64, 1), new THREE.MeshStandardMaterial({ ...textures.set('floor', 16, 16), color: 0x7b838c, metalness: 0.6 }));
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = 0.005;
    outerFloor.receiveShadow = true;
    this.add(outerFloor);
    // Glowing floor rings (curves) mark the scanner's reach.
    for (const [r, m] of [[BEAM_RADIUS, this.mat.cyan], [5, this.mat.cyan]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.05, r + 0.05, 96), m);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      this.add(ring);
    }

    // Outer cylindrical wall with a gap to the north for the reactor lift.
    const wallSet = textures.set('panels', 24, 4);
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, 7.2, 96, 1, true, Math.PI + gapHalf, Math.PI * 2 - gapHalf * 2),
      new THREE.MeshStandardMaterial({ ...wallSet, color: 0xa7b4c3, metalness: 0.5, side: THREE.BackSide })
    );
    wall.position.y = 3.6;
    wall.receiveShadow = true;
    this.add(wall);
    physics.addRing(0, 0, R, R + 2, 0, 7.2, { gaps: [{ angle: -Math.PI / 2, half: gapHalf }], blocksSight: true });
    // Light band around the top of the wall.
    const band = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.06, 8, 128), this.mat.cyan);
    band.rotation.x = Math.PI / 2;
    band.position.y = 7.0;
    this.add(band);
    const lowBand = band.clone();
    lowBand.position.y = 0.25;
    this.add(lowBand);

    // Glass dome with curved ribs (half tori), seen against the nebula sky.
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(R, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({
        color: 0x9fd8ff, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.1,
        side: THREE.BackSide, depthWrite: false, envMapIntensity: 2.0
      })
    );
    dome.position.y = 7.2;
    dome.scale.y = 0.55;
    this.add(dome);
    for (let i = 0; i < 6; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(R, 0.14, 8, 64, Math.PI), this.mat.dark);
      rib.rotation.y = (i / 6) * Math.PI;
      rib.position.y = 7.2;
      rib.scale.set(1, 0.55, 1);
      this.add(rib);
    }

    // Upper ring catwalk (grate) + railing, collision via an analytic ring.
    const catwalk = new THREE.Mesh(new THREE.RingGeometry(CATWALK_IN, R, 96, 2), this.mat.grate);
    catwalk.material = this.mat.grate.clone();
    catwalk.material.map = null;
    const grateTex = textures.set('grate', 40, 2);
    catwalk.material.alphaMap = grateTex.alphaMap;
    catwalk.material.normalMap = grateTex.normalMap;
    catwalk.rotation.x = -Math.PI / 2;
    catwalk.position.y = CATWALK_Y;
    catwalk.castShadow = true;
    catwalk.receiveShadow = true;
    this.add(catwalk);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(CATWALK_IN, 0.06, 8, 128), this.mat.amber);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = CATWALK_Y + 0.02;
    this.add(edge);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(CATWALK_IN + 0.1, 0.04, 6, 128), this.mat.dark);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = CATWALK_Y + 1.0;
    this.add(rail);
    physics.addRing(0, 0, CATWALK_IN, R + 0.1, CATWALK_Y - 0.15, CATWALK_Y, {});
    // Support columns under the catwalk.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2;
      const x = Math.cos(a) * (CATWALK_IN + 0.4), z = Math.sin(a) * (CATWALK_IN + 0.4);
      if (Math.abs(a - 1.5 * Math.PI) < 0.4) continue;
      this.box(0.3, CATWALK_Y, 0.3, x, CATWALK_Y / 2, z, this.mat.dark, { tile: 1 });
    }

    // Staircases (east and west) up to the catwalk — auto step-up physics.
    for (const side of [-1, 1]) {
      const steps = 8;
      const rise = CATWALK_Y / steps;
      for (let i = 0; i < steps; i++) {
        const top = rise * (i + 1);
        const z = -3.2 + i * 0.95;
        this.box(2.0, top, 0.95, side * 11.0, top / 2, z, this.mat.floor, { tile: 1 });
        this.box(2.0, 0.04, 0.12, side * 11.0, top + 0.02, z - 0.42, this.mat.hazard, { collide: false, tile: 1 });
      }
      // Landing that joins the stairs to the ring catwalk.
      this.box(2.6, 0.2, 2.2, side * 11.6, CATWALK_Y - 0.1, 5.5, this.mat.floor, { tile: 1 });
      makeSign(this, side < 0 ? 'UPPER RING ▲' : '▲ UPPER RING', { x: side * 9.95, y: 2.2, z: -3.4, rotationY: side < 0 ? Math.PI / 2 : -Math.PI / 2, width: 1.8, height: 0.32 });
    }

    // Cover pillars: block the turret's line of sight.
    this.pillars = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * 7.2, z = Math.sin(a) * 7.2;
      this.box(1.3, 2.8, 1.3, x, 1.4, z, this.mat.pillar, { tile: 1.4 });
      this.box(1.34, 0.12, 1.34, x, 2.2, z, this.mat.amber, { collide: false, tile: 1 });
      this.pillars.push(new THREE.Vector3(x, 0, z));
    }

    // Jump pads to the catwalk.
    this.jumpPads = [];
    for (const a of [Math.PI * 0.62, Math.PI * 0.38]) {
      const pos = new THREE.Vector3(Math.cos(a) * 9.8, 0, Math.sin(a) * 9.8);
      const pad = new THREE.Group();
      pad.position.copy(pos);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.12, 32), this.mat.dark);
      base.position.y = 0.06;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 8, 32), this.mat.green);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.13;
      const holo = createHologramMaterial(0x37ff8b, 0.5);
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.4, 24, 1, true), holo);
      column.position.y = 0.75;
      pad.add(base, ring, column);
      this.add(pad);
      this.jumpPads.push({ pos, holo, cooldown: 0, dir: pos.clone().setY(0).normalize() });
      this.addMarker(pos, '#37ff8b', 'dot');
    }

    // Lighting: starlight through the dome (shadow-casting) + accent spots.
    this.add(new THREE.HemisphereLight(0x8fb6ff, 0x1a1414, 0.9));
    const star = new THREE.DirectionalLight(0xcfe2ff, 1.6);
    star.position.set(8, 20, -6);
    star.castShadow = true;
    star.shadow.mapSize.set(this.game.engine.quality.shadowSize, this.game.engine.quality.shadowSize);
    const sc = star.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 50;
    star.shadow.bias = -0.0006;
    this.add(star);
    this.add(star.target);
    for (const a of [0.3, 2.4, 4.4]) {
      const spot = new THREE.SpotLight(0x9fd0ff, 40, 20, 0.55, 0.7, 1.4);
      spot.position.set(Math.cos(a) * 14, 6.8, Math.sin(a) * 14);
      spot.target.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6);
      this.add(spot, spot.target);
    }

    this.terminals = [
      new Terminal(this, { x: -3.2, z: 14.2, rotationY: Math.PI, log: LOGS.security }),
      new Terminal(this, { x: Math.cos(Math.PI * 1.08) * 14.8, z: Math.sin(Math.PI * 1.08) * 14.8, rotationY: Math.PI / 2 - Math.PI * 1.08 + Math.PI, log: LOGS.power })
    ];
    // Lift that SPARK arrived in.
    const arrival = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.4, 48), this.mat.green);
    arrival.rotation.x = -Math.PI / 2;
    arrival.position.set(0, 0.02, 13.6);
    this.add(arrival);
    this.pickups = [
      new Pickup(this, { position: new THREE.Vector3(-13.8, CATWALK_Y + 1.0, 6.5), kind: 'repair' }),
      new Pickup(this, { position: new THREE.Vector3(9.5, 1.0, -4), kind: 'repair' })
    ];
  }

  // ---------------------------------------------------------------- turret --
  buildTurret() {
    // Hierarchy: Turret → Pivot (yaw) → Head → Lens; Pivot → Beam wedge + SpotLight
    const turret = new THREE.Group();
    turret.name = 'Turret';
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.6, 24), this.mat.dark);
    base.position.y = 0.8;
    base.castShadow = true;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 8, 32), this.mat.amber);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.55;
    turret.add(base, collar);
    this.physics.addCentered(0, 0.9, 0, 2.0, 1.8, 2.0);

    const pivot = new THREE.Group();
    pivot.name = 'Pivot';
    pivot.position.y = 1.75;
    const head = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.55, 0.8, 3, 0.12), new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.3, roughness: 0.4 }));
    head.castShadow = true;
    pivot.add(head);
    this.lensMat = emissive(0x37c8ff, 5);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 20), this.lensMat);
    lens.rotation.z = Math.PI / 2;
    lens.position.x = 0.58;
    pivot.add(lens);
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.3), this.mat.dark);
      fin.position.set(-0.2, 0, s * 0.45);
      pivot.add(fin);
    }

    // The wedge sits on the floor, so offset it down from the pivot.
    this.scannerMat = createScannerMaterial(BEAM_RADIUS, BEAM_HALF);
    const wedge = new THREE.Mesh(createWedgeGeometry(BEAM_RADIUS, BEAM_HEIGHT, BEAM_HALF, 28), this.scannerMat);
    wedge.position.y = -1.75;
    wedge.renderOrder = 5;
    pivot.add(wedge);

    this.turretSpot = new THREE.SpotLight(0x37c8ff, 50, 16, BEAM_HALF * 1.3, 0.5, 1.2);
    this.turretSpot.position.set(0.6, 0, 0);
    const target = new THREE.Object3D();
    target.position.set(8, -1.6, 0);
    pivot.add(this.turretSpot, target);
    this.turretSpot.target = target;
    turret.add(pivot);
    this.turretPivot = pivot;
    this.add(turret);
    this.addMarker(new THREE.Vector3(0, 0, 0), '#ff3344', 'turret');
  }

  // ------------------------------------------------------------- junctions --
  buildJunctions() {
    // Random distinct loads; the solution is ascending MW. Two panels use other units.
    const pool = [40, 75, 120, 160, 210, 260, 320, 380, 450, 520, 610, 700];
    const loads = pool.sort(() => Math.random() - 0.5).slice(0, 5);
    const units = ['MW', 'MW', 'MW', 'kW', 'GW'].sort(() => Math.random() - 0.5);
    const spots = [
      { pos: new THREE.Vector3(-9.0, 0, 2.6), upper: false },
      { pos: new THREE.Vector3(9.0, 0, 2.6), upper: false },
      { pos: new THREE.Vector3(-5.2, 0, -8.2), upper: false },
      { pos: new THREE.Vector3(Math.cos(Math.PI * 1.06) * 15.3, CATWALK_Y, Math.sin(Math.PI * 1.06) * 15.3), upper: true },
      { pos: new THREE.Vector3(Math.cos(-Math.PI * 0.17) * 15.3, CATWALK_Y, Math.sin(-Math.PI * 0.17) * 15.3), upper: true }
    ];
    this.junctions = spots.map((s, i) => this.createJunction(i + 1, s, loads[i], units[i]));
    const order = [...this.junctions].sort((a, b) => a.load - b.load);
    order.forEach((j, rank) => { j.rank = rank; });
    this.solutionOrder = order.map((j) => `J${j.id}`);
  }

  createJunction(id, { pos, upper }, load, unit) {
    // Hierarchy: Junction → Housing, Screen, StatusLight, LeverPivot → Handle
    const g = new THREE.Group();
    g.name = `Junction${id}`;
    g.position.copy(pos);
    // Face the room centre (horizontal only).
    g.rotation.y = Math.atan2(-pos.x, -pos.z) + Math.PI;
    const housing = new THREE.Mesh(new RoundedBoxGeometry(1.2, 1.9, 0.6, 3, 0.06), this.mat.dark);
    housing.position.y = 0.95;
    housing.castShadow = housing.receiveShadow = true;
    g.add(housing);
    const screenTex = makeLabelTexture([`JUNCTION ${id}`, formatLoad(load, unit)], {
      width: 384, height: 192, color: '#ffd36b', border: '#ffb020', font: '700 44px Orbitron, sans-serif'
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.48), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
    screen.position.set(0, 1.45, -0.305);
    screen.rotation.y = Math.PI;
    g.add(screen);
    const statusMat = emissive(0xff3344, 3);
    const status = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), statusMat);
    status.position.set(0.42, 1.82, -0.3);
    g.add(status);
    const leverPivot = new THREE.Group();
    leverPivot.position.set(0, 0.85, -0.32);
    leverPivot.rotation.x = 0.7;
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.35, 4, 8), new THREE.MeshStandardMaterial({ color: 0xff3344, roughness: 0.4 }));
    handle.position.y = 0.2;
    leverPivot.add(handle);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    knob.position.y = 0.4;
    leverPivot.add(knob);
    g.add(leverPivot);
    this.add(g);
    const front = new THREE.Vector3(0, 0, -1).applyQuaternion(g.quaternion);
    // Collider (approximate footprint).
    this.physics.addCentered(pos.x, pos.y + 0.95, pos.z, 1.0, 1.9, 1.0);

    // Energy cable from the junction to the master console (CatmullRom curve → TubeGeometry).
    const start = pos.clone().addScaledVector(front, 0.2).setY(pos.y + 0.05);
    const points = [start];
    if (upper) {
      const r = Math.hypot(pos.x, pos.z);
      const dir = new THREE.Vector3(pos.x / r, 0, pos.z / r);
      points.push(dir.clone().multiplyScalar(CATWALK_IN + 0.3).setY(CATWALK_Y - 0.1));
      points.push(dir.clone().multiplyScalar(CATWALK_IN + 0.5).setY(0.06));
      points.push(dir.clone().multiplyScalar(10.5).setY(0.06));
    } else if (pos.z > -5) {
      points.push(start.clone().lerp(new THREE.Vector3(0, 0.06, 0), 0.25).setY(0.06));
    }
    // Route around the end of the shield wall to the console.
    const side = Math.sign(pos.x || 1);
    if (pos.z > -5 || upper) points.push(new THREE.Vector3(side * 3.0, 0.06, -5.0));
    points.push(new THREE.Vector3(side * 2.75, 0.06, -8.6));
    points.push(new THREE.Vector3(side * 0.6, 0.06, CONSOLE_POS.z + 0.8));
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
    const cableMat = createEnergyFlowMaterial(0x37ff8b);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.07, 8, false), cableMat);
    this.add(cable);

    const junction = {
      id, load, unit, group: g, statusMat, leverPivot, cableMat, screenTex,
      online: false, flow: 0, error: 0, position: pos.clone().addScaledVector(front, 0.9).setY(pos.y + 1.0)
    };
    this.addInteractable({
      position: junction.position,
      radius: 2.0,
      hold: 1.0,
      prompt: () => `Hold E — bring Junction ${id} online (${formatLoad(load, unit)})`,
      enabled: () => !junction.online,
      onInteract: () => this.activateJunction(junction)
    });
    this.addMarker(junction.position, '#ffb020', 'square', { visible: () => !junction.online, label: `J${id}` });
    this.addScanTarget(junction.position, `J${id} · ${formatLoad(load, unit)}`, '#ffb020', () => !junction.online);
    return junction;
  }

  activateJunction(j) {
    const game = this.game;
    game.player.rig.triggerReach();
    if (j.rank === this.progress) {
      j.online = true;
      this.progress++;
      j.statusMat.emissive.set(0x37ff8b);
      j.screenTex.userData.redraw([`JUNCTION ${j.id}`, 'ONLINE'], { color: '#37ff8b', border: '#37ff8b' });
      audio.play('junction', { position: j.group.position });
      game.ui.toast(`Junction ${j.id} online (${this.progress}/5)`, '#37ff8b');
      if (this.progress === 1) game.say('Breaker holding. Keep going — lowest load to highest.');
      if (this.progress === 3) game.say('Three junctions live. The sentry is speeding up as power returns.');
      if (this.progress === 5) {
        game.say('All junctions online! Now route the power at the master console on the north side.');
        this.objective = 'Route power at the master console';
        this.consoleScreen.userData.redraw(['MASTER CONSOLE', 'GRID READY'], { color: '#37ff8b', border: '#37ff8b' });
      }
      this.checkpoint.position.copy(game.player.position);
      this.checkpoint.yaw = game.player.yaw;
    } else {
      // Breaker trip: everything resets, time penalty, a jolt of current.
      audio.play('surge', { position: j.group.position });
      game.player.damage(12, j.group.position, 5, 'Electrocuted by a breaker surge');
      this.timeLeft = Math.max(1, this.timeLeft - 10);
      game.ui.toast('BREAKER TRIP — wrong order! Sequence reset (−10 s)', '#ff4455');
      game.say('Breaker trip! That was not the lowest remaining load. The sequence has reset.');
      game.stats.mistakes++;
      for (const k of this.junctions) {
        if (k.online) {
          k.online = false;
          k.statusMat.emissive.set(0xff3344);
          k.screenTex.userData.redraw([`JUNCTION ${k.id}`, formatLoad(k.load, k.unit)], { color: '#ffd36b', border: '#ffb020' });
        }
        k.error = 1;
      }
      this.progress = 0;
    }
  }

  // --------------------------------------------------------------- console --
  buildConsole() {
    const g = new THREE.Group();
    g.name = 'MasterConsole';
    g.position.copy(CONSOLE_POS);
    const desk = new THREE.Mesh(new RoundedBoxGeometry(3.6, 1.0, 1.2, 3, 0.08), this.mat.dark);
    desk.position.y = 0.5;
    desk.castShadow = desk.receiveShadow = true;
    g.add(desk);
    this.consoleScreen = makeLabelTexture(['MASTER CONSOLE', 'JUNCTIONS OFFLINE'], {
      width: 512, height: 192, color: '#ff8a3a', border: '#ff8a3a', font: '700 46px Orbitron, sans-serif'
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: this.consoleScreen, toneMapped: false }));
    screen.position.set(0, 1.7, -0.35);
    g.add(screen);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 0.1), this.mat.dark);
    back.position.set(0, 1.7, -0.42);
    g.add(back);
    // Holographic reactor above the console (custom core shader, small).
    this.miniCore = createReactorCoreMaterial();
    const mini = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 12), this.miniCore);
    mini.position.set(1.35, 1.45, 0.1);
    g.add(mini);
    this.consoleHolo = createHologramMaterial(0xff8a3a, 0.5);
    const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), this.consoleHolo);
    cage.position.copy(mini.position);
    g.add(cage);
    this.miniCoreMesh = mini;
    this.consoleCage = cage;
    this.add(g);
    this.physics.addCentered(CONSOLE_POS.x, 0.6, CONSOLE_POS.z, 3.6, 1.2, 1.2);
    // A shield wall between the turret and the console: safe to solve the grid.
    this.box(5, 2.6, 0.4, 0, 1.3, -7.0, this.mat.pillar, { tile: 1.4 });
    this.box(5.04, 0.12, 0.44, 0, 2.2, -7.0, this.mat.amber, { collide: false, tile: 1 });
    makeSign(this, 'MASTER CONSOLE', { x: 0, y: 1.6, z: -7.22, rotationY: Math.PI, width: 2.4, height: 0.4, color: '#ff8a3a' });

    this.addInteractable({
      position: new THREE.Vector3(0, 1.0, CONSOLE_POS.z + 1.0),
      radius: 2.4,
      prompt: () => (this.progress < 5 ? `Master console — junctions ${this.progress}/5` : 'Open the power routing grid'),
      enabled: () => !this.gridSolved,
      onInteract: () => {
        if (this.progress < 5) {
          audio.play('locked');
          this.game.ui.toast('Bring all five junctions online first', '#ff8a3a');
          return;
        }
        this.game.openRoutingGrid({ onSolved: () => this.onGridSolved() });
      }
    });
    this.addMarker(new THREE.Vector3(0, 0, CONSOLE_POS.z), '#ff8a3a', 'square', { label: 'MC' });
    this.addScanTarget(new THREE.Vector3(0, 1.4, CONSOLE_POS.z), 'MASTER CONSOLE', '#ff8a3a', () => !this.gridSolved);
  }

  onGridSolved() {
    this.gridSolved = true;
    this.consoleScreen.userData.redraw(['MASTER CONSOLE', 'POWER ROUTED'], { color: '#37ff8b', border: '#37ff8b' });
    this.consoleHolo.uniforms.uColor.value.set(0x37ff8b);
    this.fieldDropping = true;
    audio.play('success');
    this.game.say('Power routed. The containment field on the reactor lift is down. Go — the core is still critical.');
    this.objective = 'Enter the reactor lift (north)';
    this.checkpoint.position.set(0, 0, CONSOLE_POS.z + 1.6);
    this.checkpoint.yaw = 0;
  }

  // ------------------------------------------------------ catwalk hazards --
  buildCatwalkHazards() {
    // Arcing conduits: lightning bolts across the catwalk on a timer.
    this.arcs = [];
    for (const a of [Math.PI * 0.96, Math.PI * 0.03]) {
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const from = dir.clone().multiplyScalar(R - 0.15).setY(CATWALK_Y + 1.6);
      const to = dir.clone().multiplyScalar(CATWALK_IN + 0.1).setY(CATWALK_Y + 1.0);
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(16 * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(2.5, 3.5, 6.0), transparent: true, toneMapped: false });
      const line = new THREE.Line(geometry, mat);
      line.frustumCulled = false;
      this.add(line);
      const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 12), this.mat.cyan);
      emitter.position.copy(from);
      emitter.rotation.z = Math.PI / 2;
      emitter.rotation.y = -a;
      this.add(emitter);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), this.mat.dark);
      post.position.copy(to).setY(CATWALK_Y + 0.5);
      this.add(post);
      this.arcs.push({ angle: a, from, to, line, positions, mat, offset: Math.random() * 2, state: 'idle' });
      this.addMarker(dir.clone().multiplyScalar(14.2), '#6fd8ff', 'hazard');
    }
  }

  updateArcs(dt, t) {
    const player = this.game.player;
    const p = player.position;
    for (const arc of this.arcs) {
      const phase = (t + arc.offset) % 2.8;
      const state = phase < 1.4 ? 'idle' : phase < 1.9 ? 'warn' : 'live';
      if (state !== arc.state && state === 'live' && p.distanceTo(arc.from) < 14) audio.play('zap', { position: arc.from, volume: 0.5 });
      arc.state = state;
      const show = state === 'live' || (state === 'warn' && Math.random() < 0.25);
      arc.line.visible = show;
      if (show) {
        const n = arc.positions.length / 3;
        for (let i = 0; i < n; i++) {
          const k = i / (n - 1);
          const jitter = state === 'live' ? 0.35 : 0.15;
          arc.positions[i * 3] = THREE.MathUtils.lerp(arc.from.x, arc.to.x, k) + (i > 0 && i < n - 1 ? (Math.random() - 0.5) * jitter : 0);
          arc.positions[i * 3 + 1] = THREE.MathUtils.lerp(arc.from.y, arc.to.y, k) + (i > 0 && i < n - 1 ? (Math.random() - 0.5) * jitter : 0);
          arc.positions[i * 3 + 2] = THREE.MathUtils.lerp(arc.from.z, arc.to.z, k) + (i > 0 && i < n - 1 ? (Math.random() - 0.5) * jitter : 0);
        }
        arc.line.geometry.attributes.position.needsUpdate = true;
        arc.mat.opacity = state === 'live' ? 1 : 0.4;
      }
      if (state === 'live' && p.y > CATWALK_Y - 0.5) {
        const pa = Math.atan2(p.z, p.x);
        let diff = Math.abs(pa - arc.angle) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff * Math.hypot(p.x, p.z) < 0.75) player.damage(20, arc.from.clone().setY(p.y), 6, 'Electrocuted by an arcing conduit');
      }
    }
  }

  // ------------------------------------------------------------------ exit --
  buildExit() {
    // Corridor beyond the gap in the north wall, ending at the reactor lift.
    const z0 = -R + 0.2, z1 = -R - 8;
    const zc = (z0 + z1) / 2, len = z0 - z1;
    this.box(1, 4, len, -2.8, 2, zc, this.mat.wall, { tile: 2 });
    this.box(1, 4, len, 2.8, 2, zc, this.mat.wall, { tile: 2 });
    this.box(6.6, 0.4, len, 0, 3.6, zc, this.mat.dark, { minimap: false, tile: 2 });
    this.box(6.6, 4, 1, 0, 2, z1 - 0.5, this.mat.wall, { tile: 2 });
    this.box(4.6, 0.02, len, 0, 0.012, zc, this.mat.floor, { collide: false, tile: 2 });

    this.fieldMat = createForceFieldMaterial(0xff8a3a);
    const field = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.4), this.fieldMat);
    field.position.set(0, 1.7, -R + 0.1);
    this.add(field);
    this.fieldCollider = this.physics.addBox(-2.3, 0, -R - 0.1, 2.3, 3.4, -R + 0.3, { tag: 'door' });
    this.fieldOpacity = 1;

    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.65, 48), this.mat.green);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.02, z1 + 2.2);
    this.add(ring);
    this.exitHolo = createHologramMaterial(0x37ff8b, 0.4);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.2, 40, 1, true), this.exitHolo);
    col.position.set(0, 1.6, z1 + 2.2);
    this.add(col);
    const exitLight = new THREE.PointLight(0xff8a3a, 8, 10, 1.8);
    exitLight.position.set(0, 3, -R - 3);
    this.add(exitLight);
    this.exitLight = exitLight;
    makeSign(this, 'REACTOR LIFT ▼ CORE', { x: 0, y: 3.0, z: -R + 0.32, width: 3.2, height: 0.45, color: '#ff8a3a' });
    this.exitZone = makeZone(-2.2, -1, z1, 2.2, 3, z1 + 4.2);
    this.addMarker(new THREE.Vector3(0, 0, z1 + 2.2), '#37ff8b', 'goal', { visible: () => this.gridSolved });
  }

  // ------------------------------------------------------------ lifecycle --
  start() {
    this.game.say('Control room. The sentry is in lockdown mode and the core will breach in four minutes. Bring the power junctions online — lowest load first.');
    this.game.ui.hintPrompt('New: jump pads launch you to the upper ring · hold E on junctions');
  }

  onRespawn() {
    this.detection = 0;
  }

  update(dt) {
    super.update(dt);
    const game = this.game;
    const player = game.player;
    const t = this.time;

    // Countdown.
    if (!this.completed) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        game.gameOver('The control room lost power. The reactor breached.');
        return;
      }
    }

    // Sky + console shaders.
    this.sky.position.copy(game.camera.position);
    const sky = this.sky.material.uniforms;
    sky.uTime.value = t;
    sky.uSpin.value = t * 0.01;
    sky.uAlarm.value = THREE.MathUtils.lerp(sky.uAlarm.value, this.detection > 0.3 ? 0.6 : 0, 1 - Math.exp(-dt * 4));
    this.miniCore.uniforms.uTime.value = t;
    this.miniCore.uniforms.uInstability.value = 1 - this.progress / 5;
    this.miniCoreMesh.rotation.y += dt;
    this.consoleHolo.uniforms.uTime.value = t;
    this.consoleCage.rotation.y -= dt * 0.6;
    this.exitHolo.uniforms.uTime.value = t;

    // Junction cables: energy flows to the console as each comes online.
    for (const j of this.junctions) {
      j.flow = THREE.MathUtils.clamp(j.flow + (j.online ? dt * 0.7 : -dt * 2), 0, 1.02);
      j.error = Math.max(0, j.error - dt * 1.2);
      j.cableMat.uniforms.uTime.value = t;
      j.cableMat.uniforms.uProgress.value = j.flow;
      j.cableMat.uniforms.uError.value = j.error;
      j.leverPivot.rotation.x = THREE.MathUtils.lerp(j.leverPivot.rotation.x, j.online ? -0.7 : 0.7, 1 - Math.exp(-dt * 10));
    }
    for (const p of this.pickups) p.update(dt, t);

    this.updateTurret(dt, t);
    this.updateArcs(dt, t);

    // Jump pads.
    for (const pad of this.jumpPads) {
      pad.holo.uniforms.uTime.value = t;
      pad.cooldown = Math.max(0, pad.cooldown - dt);
      const d = Math.hypot(player.position.x - pad.pos.x, player.position.z - pad.pos.z);
      if (d < 0.85 && player.body.grounded && player.position.y < 0.3 && pad.cooldown === 0) {
        pad.cooldown = 0.6;
        player.body.velocity.set(pad.dir.x * 4.6, 13.6, pad.dir.z * 4.6);
        player.launchTimer = 1.0;
        player.thrust = 1.2;
        audio.play('boost');
        game.stats.boosts++;
      }
    }

    // Force field drop.
    if (this.fieldDropping && this.fieldOpacity > 0) {
      this.fieldOpacity = Math.max(0, this.fieldOpacity - dt * 0.6);
      this.fieldMat.uniforms.uOpacity.value = this.fieldOpacity;
      this.fieldCollider.enabled = this.fieldOpacity > 0.3;
      if (this.fieldOpacity === 0) this.exitLight.color.set(0x37ff8b);
    }
    this.fieldMat.uniforms.uTime.value = t;
    // Ripple when the player touches the active field.
    if (this.fieldCollider.enabled && player.position.z < -R + 0.9 && Math.abs(player.position.x) < 2.3 && t - this.fieldMat.uniforms.uImpactTime.value > 0.6) {
      this.fieldMat.uniforms.uImpactTime.value = t;
      this.fieldMat.uniforms.uImpactPos.value.set(player.position.x, player.position.y + 0.8, -R + 0.1);
      audio.play('locked', { volume: 0.5 });
    }

    if (this.gridSolved && !this.completed && pointInBox(player.position, this.exitZone)) {
      this.completed = true;
      game.completeLevel();
    }

    // Music tension follows the clock and the turret.
    const urgency = 1 - this.timeLeft / this.timeLimit;
    game.audio.setIntensity(Math.max(urgency, this.detection, this.progress / 6));
  }

  updateTurret(dt, t) {
    const game = this.game;
    const player = game.player;
    const speed = 0.5 * settings.difficulty.beamSpeed * (1 + this.progress * 0.12);
    if (this.turretCooldown > 0) this.turretCooldown -= dt;
    else this.beamAngle += dt * speed;
    this.turretPivot.rotation.y = -this.beamAngle;

    // Detection: inside the wedge, on the floor, with clear line of sight.
    const p = player.position;
    const dx = p.x, dz = p.z;
    const dist = Math.hypot(dx, dz);
    let seen = false;
    if (dist < BEAM_RADIUS + 0.3 && dist > 1 && p.y < BEAM_HEIGHT - 0.3 && this.turretCooldown <= 0) {
      const a = Math.atan2(dz, dx);
      let diff = Math.abs(a - this.beamAngle) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      const angularHalf = BEAM_HALF + 0.32 / dist; // account for the robot's width
      if (diff < angularHalf) {
        const eye = _eye.set(0, 1.75, 0);
        const chest = _chest.set(p.x, p.y + 0.6, p.z);
        const head = _head.set(p.x, p.y + player.body.height - 0.1, p.z);
        seen = !this.physics.isOccluded(eye, chest) || !this.physics.isOccluded(eye, head);
      }
    }
    if (seen) this.detection = Math.min(1, this.detection + dt * 3.2);
    else this.detection = Math.max(0, this.detection - dt * 1.5);

    const alert = this.detection;
    this.scannerMat.uniforms.uTime.value = t;
    this.scannerMat.uniforms.uAlert.value = alert;
    this.lensMat.emissive.setRGB(0.2 + alert * 0.8, 0.78 * (1 - alert) + 0.1, 1 - alert * 0.8);
    this.turretSpot.color.copy(this.lensMat.emissive);
    game.ui.setDetection(alert);

    if (this.detection >= 1) {
      this.detection = 0;
      this.turretCooldown = 1.2;
      audio.play('alarm', { position: _eye.set(0, 1.75, 0), volume: 0.7 });
      audio.play('zap');
      if (player.damage(25, _eye.set(0, 0, 0), 8, 'Neutralised by the security sentry')) {
        this.timeLeft = Math.max(1, this.timeLeft - 5);
        game.ui.toast('SENTRY ZAP — security lockdown (−5 s)', '#ff4455');
        game.stats.detections++;
      }
    }
  }

  hints() {
    if (this.progress < 5) {
      const next = this.junctions.find((j) => j.rank === this.progress);
      return [
        'Five junctions: three on the floor, two on the upper ring (stairs east/west, or the green jump pads).',
        'Bring them online from the lowest load to the highest. Careful — some panels show kW or GW. 1 GW = 1,000 MW; 1 MW = 1,000 kW.',
        `The correct order is ${this.solutionOrder.join(' → ')}. Next: Junction ${next.id}.`
      ];
    }
    if (!this.gridSolved) {
      return [
        'Use the master console on the north side, behind the shield wall.',
        'Click tiles to rotate them (right-click rotates the other way). Connect the glowing source on the left to the output on the right.'
      ];
    }
    return ['The reactor lift is through the dropped force field in the north wall.'];
  }

  objectiveText() {
    if (this.progress < 5) return `Bring the junctions online, lowest load first (${this.progress}/5)`;
    return this.objective;
  }
}

const _eye = new THREE.Vector3();
const _chest = new THREE.Vector3();
const _head = new THREE.Vector3();
