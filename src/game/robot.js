// SPARK, the maintenance robot — a hierarchical model.
//
//   Robot (root: world position + yaw)
//   └─ Chassis (bob / lean)
//      ├─ Wheel (ball wheel: rolls with distance travelled)
//      ├─ Fork
//      └─ Torso
//         ├─ Backpack ─ NozzleL/R ─ FlameL/R (thruster flames)
//         ├─ ShoulderL/R ─ ArmL/R ─ ForearmL/R ─ ClawL/R
//         └─ Head (pitches with the camera) ─ Visor, Antenna ─ AntennaTip
//
// Every child is placed relative to its parent, so swinging a shoulder carries
// the arm, forearm and claw with it, and pitching the head carries the visor
// and antenna. If the Blender-authored GLB is available, its meshes replace
// these procedural ones but keep the same node names and therefore the same
// animation code.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { textures } from '../engine/textures.js';
import { createHologramMaterial } from '../shaders/effects.js';

function robotMaterials() {
  const brushed = textures.brushed();
  return {
    shell: new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: 0.42, metalness: 0.08 }),
    accent: new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.5, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x39424d, roughness: 0.32, metalness: 0.85,
      bumpMap: brushed.bumpMap, bumpScale: 0.6
    }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.9, metalness: 0, flatShading: true }),
    glass: new THREE.MeshStandardMaterial({ color: 0x05080c, roughness: 0.08, metalness: 0.6 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x0a1a22, emissive: 0x37c8ff, emissiveIntensity: 3.2 }),
    tip: new THREE.MeshStandardMaterial({ color: 0x220a00, emissive: 0xff8a1f, emissiveIntensity: 4 }),
    flame: createHologramMaterial(0x6fd8ff, 1)
  };
}

function mesh(geometry, material, name) {
  const m = new THREE.Mesh(geometry, material);
  if (name) m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function group(name, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
}

export function buildProceduralRobot() {
  const M = robotMaterials();
  const root = group('Robot');
  const chassis = group('Chassis');
  root.add(chassis);

  // Ball wheel with flat-shaded tread facets.
  const wheel = group('Wheel', 0, 0.22, 0);
  wheel.add(mesh(new THREE.IcosahedronGeometry(0.22, 1), M.rubber));
  const hub = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.46, 16), M.metal);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  chassis.add(wheel);

  const fork = group('Fork', 0, 0.3, 0);
  for (const side of [-1, 1]) {
    const plate = mesh(new RoundedBoxGeometry(0.06, 0.3, 0.26, 2, 0.02), M.accent);
    plate.position.set(side * 0.26, 0, 0);
    fork.add(plate);
  }
  const hip = mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.12, 24), M.metal);
  hip.position.y = 0.16;
  fork.add(hip);
  chassis.add(fork);

  const torso = group('Torso', 0, 0.7, 0);
  torso.add(mesh(new RoundedBoxGeometry(0.52, 0.42, 0.38, 4, 0.08), M.shell));
  const chest = mesh(new RoundedBoxGeometry(0.32, 0.13, 0.03, 2, 0.01), M.accent);
  chest.position.set(0, 0.04, -0.19);
  torso.add(chest);
  const chestLight = mesh(new THREE.CircleGeometry(0.03, 16), M.visor, 'ChestLight');
  chestLight.position.set(0.1, -0.1, -0.192);
  chestLight.rotation.y = Math.PI;
  torso.add(chestLight);
  chassis.add(torso);

  const backpack = group('Backpack', 0, -0.02, 0.24);
  backpack.add(mesh(new RoundedBoxGeometry(0.38, 0.32, 0.14, 3, 0.04), M.metal));
  for (const [side, name] of [[-1, 'L'], [1, 'R']]) {
    const nozzle = group(`Nozzle${name}`, side * 0.1, -0.2, 0.02);
    nozzle.add(mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.1, 12), M.metal));
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 12, 1, true), M.flame);
    flame.name = `Flame${name}`;
    flame.rotation.x = Math.PI;
    flame.position.y = -0.24;
    flame.scale.setScalar(0.001);
    nozzle.add(flame);
    backpack.add(nozzle);
  }
  torso.add(backpack);

  for (const [side, name] of [[-1, 'L'], [1, 'R']]) {
    const shoulder = group(`Shoulder${name}`, side * 0.31, 0.12, 0);
    shoulder.add(mesh(new THREE.SphereGeometry(0.075, 16, 12), M.metal));
    const arm = group(`Arm${name}`, side * 0.02, -0.02, 0);
    const upper = mesh(new THREE.CapsuleGeometry(0.045, 0.16, 4, 10), M.shell);
    upper.position.y = -0.11;
    arm.add(upper);
    const forearm = group(`Forearm${name}`, 0, -0.22, 0);
    forearm.add(mesh(new THREE.SphereGeometry(0.05, 12, 10), M.metal));
    const lower = mesh(new THREE.CapsuleGeometry(0.04, 0.14, 4, 10), M.accent);
    lower.position.y = -0.1;
    forearm.add(lower);
    const claw = group(`Claw${name}`, 0, -0.21, 0);
    for (const f of [-1, 1]) {
      const finger = mesh(new THREE.BoxGeometry(0.025, 0.08, 0.04), M.metal);
      finger.position.set(f * 0.028, -0.03, 0);
      finger.rotation.z = f * 0.25;
      claw.add(finger);
    }
    forearm.add(claw);
    arm.add(forearm);
    shoulder.add(arm);
    torso.add(shoulder);
  }

  const neck = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.1, 12), M.metal);
  neck.position.y = 0.24;
  torso.add(neck);

  const head = group('Head', 0, 0.33, 0);
  head.add(mesh(new RoundedBoxGeometry(0.42, 0.3, 0.34, 4, 0.08), M.shell));
  const visorGlass = mesh(new RoundedBoxGeometry(0.34, 0.13, 0.04, 2, 0.02), M.glass);
  visorGlass.position.set(0, 0.0, -0.16);
  head.add(visorGlass);
  const visor = group('Visor', 0, 0, -0.183);
  for (const side of [-1, 1]) {
    const eye = mesh(new RoundedBoxGeometry(0.075, 0.05, 0.01, 2, 0.008), M.visor);
    eye.position.set(side * 0.075, 0, 0);
    eye.castShadow = false;
    visor.add(eye);
  }
  head.add(visor);
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 18), M.accent);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(side * 0.22, 0, 0.02);
    head.add(ear);
  }
  const antenna = group('Antenna', 0.12, 0.15, 0.06);
  const stalk = mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.22, 6), M.metal);
  stalk.position.y = 0.11;
  antenna.add(stalk);
  const tip = mesh(new THREE.SphereGeometry(0.025, 10, 8), M.tip, 'AntennaTip');
  tip.position.y = 0.23;
  antenna.add(tip);
  head.add(antenna);
  torso.add(head);

  return { root, materials: M };
}

// Binds animation to a robot hierarchy (procedural or GLB) by node name.
export class RobotRig {
  constructor(model, materials) {
    this.setModel(model, materials);
    this.wheelAngle = 0;
    this.time = 0;
    this.reach = 0;
    this.thrust = 0;
    this.visorColor = new THREE.Color(0x37c8ff);
  }

  setModel(model, materials) {
    this.model = model;
    this.materials = materials;
    const find = (name) => model.getObjectByName(name) ?? new THREE.Object3D();
    this.n = {
      chassis: find('Chassis'), wheel: find('Wheel'), torso: find('Torso'), head: find('Head'),
      shoulderL: find('ShoulderL'), shoulderR: find('ShoulderR'),
      forearmL: find('ForearmL'), forearmR: find('ForearmR'),
      antenna: find('Antenna'), flameL: find('FlameL'), flameR: find('FlameR')
    };
    this.baseTorsoY = this.n.torso.position.y;
    // Find the emissive "visor" material, whichever model we are using.
    this.visorMaterials = [];
    model.traverse((o) => {
      if (o.isMesh && o.material?.emissive && o.material.emissiveIntensity > 1.5 &&
          (o.material.name?.toLowerCase().includes('visor') || o.material === materials?.visor)) {
        if (!this.visorMaterials.includes(o.material)) this.visorMaterials.push(o.material);
      }
    });
  }

  // speed: horizontal speed (m/s); distance: metres travelled this frame.
  update(dt, { speed, distance, pitch, grounded, crouch, thrust, hurt, lowPower }) {
    this.time += dt;
    const n = this.n;
    const t = this.time;

    this.wheelAngle -= distance / 0.22;
    n.wheel.rotation.x = this.wheelAngle;

    const moving = Math.min(1, speed / 4);
    const crouchAmount = crouch ? 1 : 0;
    n.torso.position.y = THREE.MathUtils.lerp(n.torso.position.y,
      this.baseTorsoY - crouchAmount * 0.28 + Math.sin(t * 10) * 0.012 * moving + Math.sin(t * 2) * 0.008, 1 - Math.exp(-dt * 12));
    n.chassis.rotation.x = THREE.MathUtils.lerp(n.chassis.rotation.x, -moving * 0.12 + (grounded ? 0 : 0.1), 1 - Math.exp(-dt * 6));

    n.head.rotation.x = THREE.MathUtils.lerp(n.head.rotation.x, pitch * 0.7, 1 - Math.exp(-dt * 14));
    n.head.rotation.z = Math.sin(t * 1.3) * 0.03;
    n.antenna.rotation.z = Math.sin(t * 9) * 0.08 * (0.3 + moving);

    // Arms swing opposite to each other; the right one reaches when interacting.
    this.reach = Math.max(0, this.reach - dt * 2.5);
    const swing = Math.sin(t * 9) * 0.45 * moving;
    const air = grounded ? 0 : -0.8;
    n.shoulderL.rotation.x = swing + air;
    n.shoulderR.rotation.x = -swing + air - this.reach * 1.5;
    n.shoulderL.rotation.z = grounded ? 0.08 : 0.5;
    n.shoulderR.rotation.z = grounded ? -0.08 : -0.5;
    n.forearmL.rotation.x = -0.35 - moving * 0.2;
    n.forearmR.rotation.x = -0.35 - moving * 0.2 + this.reach * 0.3;

    this.thrust = THREE.MathUtils.lerp(this.thrust, thrust, 1 - Math.exp(-dt * 15));
    const flameScale = 0.001 + this.thrust * (0.9 + Math.sin(t * 60) * 0.15);
    n.flameL.scale.setScalar(flameScale);
    n.flameR.scale.setScalar(flameScale);
    if (this.materials?.flame) this.materials.flame.uniforms.uTime.value = t;

    // Visor mood: cyan normally, amber when power is low, red when hurt.
    const target = hurt > 0 ? _red : lowPower ? _amber : _cyan;
    this.visorColor.lerp(target, 1 - Math.exp(-dt * 8));
    for (const m of this.visorMaterials) m.emissive.copy(this.visorColor);
  }

  triggerReach() {
    this.reach = 1;
  }
}

const _red = new THREE.Color(0xff2a2a);
const _amber = new THREE.Color(0xffb020);
const _cyan = new THREE.Color(0x37c8ff);

// Tries to load the Blender model; resolves with null if it is unavailable so
// the game always has a working robot.
export function loadRobotModel() {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load('./assets/models/spark-robot.glb', (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      resolve(model);
    }, undefined, () => resolve(null));
  });
}

// First-person arms: children of the camera, so they move with the view.
export function buildViewArms() {
  const M = robotMaterials();
  const rig = new THREE.Group();
  rig.name = 'ViewArms';
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.28, -0.3, -0.25);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.3, 4, 10), M.accent);
    fore.rotation.x = -Math.PI / 2 + 0.25;
    fore.position.z = -0.15;
    pivot.add(fore);
    const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), M.metal);
    wrist.position.set(0, 0.04, -0.33);
    pivot.add(wrist);
    for (const f of [-1, 1]) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.1), M.metal);
      finger.position.set(f * 0.03, 0.05, -0.41);
      finger.rotation.y = -f * 0.25;
      pivot.add(finger);
    }
    pivot.rotation.z = side * 0.1;
    rig.add(pivot);
    arms.push(pivot);
  }
  rig.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;
      o.renderOrder = 10;
    }
  });
  rig.userData.arms = arms;
  return rig;
}
