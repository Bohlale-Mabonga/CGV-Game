// Base class for the three levels: construction helpers, static-geometry
// batching, interactables, and a thorough dispose() so GPU memory does not
// climb across a full playthrough.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { textures } from '../engine/textures.js';

// BoxGeometry whose UVs are scaled to world units (one texture tile per
// `tile` metres), so every wall has the same texel density whatever its size.
export function worldBox(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // Face order: +x, -x, +y, -y, +z, -z (4 verts each).
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let face = 0; face < 6; face++) {
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[face][0] / tile, uv.getY(i) * dims[face][1] / tile);
    }
  }
  return g;
}

export class Level {
  constructor(game) {
    this.game = game;
    this.physics = game.physics;
    this.root = new THREE.Group();
    this.root.name = this.constructor.name;
    this.batches = new Map(); // material -> geometries[]
    this.interactables = [];
    this.updatables = [];
    this.markers = []; // minimap markers { object|position, color, shape }
    this.scanTargets = [];
    this.loops = [];
    this.time = 0;
    this.checkpoint = { position: new THREE.Vector3(), yaw: 0 };
    this.batteryDrain = 0;
    this.timeLimit = 0;
    this.timeLeft = 0;
    this.objective = '';
    this.hintLevel = 0;
    this.completed = false;
    this.timers = [];
  }

  // ---------------------------------------------------------- materials --
  standardSet(name, repeat = 1, extra = {}) {
    const set = textures.set(name, repeat, repeat);
    return new THREE.MeshStandardMaterial({ ...set, ...extra });
  }

  // ------------------------------------------------------------ geometry --
  // Adds a box to the static batch (merged per material in finalize()).
  box(w, h, d, x, y, z, material, opts = {}) {
    const geometry = worldBox(w, h, d, opts.tile ?? 2);
    const matrix = new THREE.Matrix4();
    if (opts.rotationY) {
      matrix.makeRotationY(opts.rotationY);
      matrix.setPosition(x, y, z);
    } else {
      matrix.makeTranslation(x, y, z);
    }
    geometry.applyMatrix4(matrix);
    this.addToBatch(geometry, material);
    if (opts.collide !== false && !opts.rotationY) {
      this.physics.addCentered(x, y, z, w, h, d, {
        tag: opts.tag ?? 'solid',
        minimap: opts.minimap ?? true,
        blocksSight: opts.blocksSight ?? true
      });
    }
    return geometry;
  }

  addToBatch(geometry, material) {
    if (!this.batches.has(material)) this.batches.set(material, []);
    this.batches.get(material).push(geometry);
  }

  // Bakes a mesh's transform and adds it to the batch.
  addStaticMesh(mesh) {
    mesh.updateMatrixWorld(true);
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    this.addToBatch(g, mesh.material);
    mesh.geometry.dispose();
  }

  finalizeStatic({ castShadow = true, receiveShadow = true } = {}) {
    for (const [material, geometries] of this.batches) {
      // Normalise attribute sets so geometries can merge.
      const normalised = geometries.map((g) => {
        const ng = g.index ? g.toNonIndexed() : g;
        if (ng !== g) g.dispose();
        for (const name of Object.keys(ng.attributes)) {
          if (!['position', 'normal', 'uv'].includes(name)) ng.deleteAttribute(name);
        }
        if (!ng.attributes.uv) {
          ng.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
        }
        if (!ng.attributes.normal) ng.computeVertexNormals();
        ng.morphAttributes = {};
        return ng;
      });
      const merged = mergeGeometries(normalised, false);
      for (const g of normalised) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = castShadow && !material.userData.noShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.name = 'static-batch';
      this.root.add(mesh);
    }
    this.batches.clear();
  }

  add(object) {
    this.root.add(object);
    return object;
  }

  // Game-time timer: runs inside update(), so it pauses with the game and
  // can never fire after the level has been torn down.
  after(delay, fn) {
    this.timers.push({ at: this.time + delay, fn });
  }

  addUpdatable(fn) {
    this.updatables.push(fn);
  }

  // -------------------------------------------------------- interactables --
  // { position: Vector3, radius, prompt: string|fn, onInteract(), enabled(), hold: seconds }
  addInteractable(def) {
    const item = { radius: 2.0, hold: 0, enabled: () => true, ...def };
    this.interactables.push(item);
    return item;
  }

  addMarker(target, color, shape = 'dot', opts = {}) {
    const m = { target, color, shape, visible: () => true, ...opts };
    this.markers.push(m);
    return m;
  }

  addScanTarget(position, label, color = '#37c8ff', active = () => true) {
    this.scanTargets.push({ position, label, color, active });
  }

  addLoop(kind, position, volume) {
    const loop = this.game.audio.createLoop(kind, position);
    if (loop) {
      loop.setVolume(volume, 0.5);
      this.loops.push(loop);
    }
    return loop;
  }

  // ------------------------------------------------------------ lifecycle --
  build() {}
  start() {}
  update(dt) {
    this.time += dt;
    for (const fn of this.updatables) fn(dt, this.time);
    if (this.timers.length) {
      const due = this.timers.filter((tm) => tm.at <= this.time);
      if (due.length) {
        this.timers = this.timers.filter((tm) => tm.at > this.time);
        for (const tm of due) tm.fn();
      }
    }
  }
  onRespawn() {}
  hints() { return []; }

  dispose() {
    for (const loop of this.loops) loop.stop();
    this.loops = [];
    const disposeTexture = (t) => {
      if (t?.isTexture && !t.userData?.shared) t.dispose();
    };
    const seenMaterials = new Set();
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (seenMaterials.has(m) || m.userData?.shared) continue;
        seenMaterials.add(m);
        for (const value of Object.values(m)) disposeTexture(value);
        if (m.uniforms) for (const u of Object.values(m.uniforms)) disposeTexture(u.value);
        m.dispose();
      }
      if (o.isLight && o.shadow?.map) o.shadow.map.dispose();
      // Reflector owns a render target of its own.
      if (o.isReflector) o.dispose();
    });
    this.root.removeFromParent();
  }
}
