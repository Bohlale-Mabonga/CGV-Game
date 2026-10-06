// Reusable interactive objects shared across levels.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { textures, makeLabelTexture } from '../../engine/textures.js';
import { audio } from '../../engine/audio.js';
import {
  createHologramMaterial,
  createSteamMaterial,
  createSteamGeometry
} from '../../shaders/effects.js';

export function emissive(color, intensity = 2.5) {
  return new THREE.MeshStandardMaterial({ color: 0x050505, emissive: color, emissiveIntensity: intensity, roughness: 0.6 });
}

const _v = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Blast door — hierarchy: Door → Frame (pillars, header, status strip)
//                                → LeafL, LeafR (slide apart when opening)
// ---------------------------------------------------------------------------
export class Door {
  constructor(level, { x, z, width = 3, height = 3, rotationY = 0, color = 0x37c8ff, locked = true, label = null }) {
    this.level = level;
    this.width = width;
    this.height = height;
    this.progress = 0;
    this.target = 0;
    this.locked = locked;
    this.group = new THREE.Group();
    this.group.name = 'Door';
    this.group.position.set(x, 0, z);
    this.group.rotation.y = rotationY;

    const panels = textures.set('panels', 1, 1);
    const hazard = textures.set('hazard', 1, 1);
    const leafMat = new THREE.MeshStandardMaterial({ ...panels, color: 0x9aa6b4, metalness: 0.6, roughness: 0.5 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a313a, metalness: 0.8, roughness: 0.35 });
    const hazardMat = new THREE.MeshStandardMaterial({ ...hazard, roughness: 0.6 });
    this.statusMat = emissive(locked ? 0xff3344 : color, 3);
    this.materials = [leafMat, frameMat, hazardMat, this.statusMat];

    const frame = new THREE.Group();
    frame.name = 'Frame';
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.35, height + 0.4, 0.6), frameMat);
      pillar.position.set(side * (width / 2 + 0.17), (height + 0.4) / 2, 0);
      pillar.castShadow = pillar.receiveShadow = true;
      frame.add(pillar);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(width + 0.7, 0.4, 0.6), frameMat);
    header.position.y = height + 0.2;
    header.castShadow = true;
    frame.add(header);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 0.08, 0.62), this.statusMat);
    strip.position.y = height + 0.2;
    frame.add(strip);
    this.group.add(frame);

    this.leaves = [];
    for (const side of [-1, 1]) {
      const leaf = new THREE.Group();
      leaf.name = side < 0 ? 'LeafL' : 'LeafR';
      const panel = new THREE.Mesh(new THREE.BoxGeometry(width / 2, height, 0.22), leafMat);
      panel.position.x = side * width / 4;
      panel.position.y = height / 2;
      panel.castShadow = panel.receiveShadow = true;
      leaf.add(panel);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.18, height, 0.24), hazardMat);
      trim.position.set(side * 0.09, height / 2, 0);
      leaf.add(trim);
      const windowStrip = new THREE.Mesh(new THREE.BoxGeometry(width / 2 - 0.4, 0.1, 0.24), this.statusMat);
      windowStrip.position.set(side * width / 4, height * 0.62, 0);
      leaf.add(windowStrip);
      this.group.add(leaf);
      this.leaves.push({ leaf, side });
    }

    if (label) {
      const tex = makeLabelTexture(label, { width: 512, height: 96, border: '#' + new THREE.Color(color).getHexString() });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.8, width * 0.15), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
      sign.position.set(0, height + 0.62, 0.31);
      this.group.add(sign);
      const back = sign.clone();
      back.rotation.y = Math.PI;
      back.position.z = -0.31;
      this.group.add(back);
    }

    level.add(this.group);
    const across = Math.abs(Math.sin(rotationY)) > 0.5;
    const hw = across ? 0.25 : width / 2;
    const hd = across ? width / 2 : 0.25;
    this.collider = level.physics.addBox(x - hw, 0, z - hd, x + hw, height, z + hd, { tag: 'door', minimap: true });
    this.openColor = new THREE.Color(color);
  }

  get isOpen() {
    return this.target === 1;
  }

  open(silent = false) {
    if (this.target === 1) return;
    this.locked = false;
    this.target = 1;
    this.statusMat.emissive.set(0x37ff8b);
    if (!silent) audio.play('door', { position: this.group.position });
  }

  close() {
    if (this.target === 0) return;
    this.target = 0;
    this.statusMat.emissive.set(0xff3344);
    audio.play('door', { position: this.group.position, volume: 0.7 });
  }

  setStatus(color) {
    this.statusMat.emissive.set(color);
  }

  update(dt) {
    const speed = 0.9;
    if (this.progress !== this.target) {
      this.progress += Math.sign(this.target - this.progress) * dt * speed;
      this.progress = THREE.MathUtils.clamp(this.progress, 0, 1);
    }
    const eased = this.progress * this.progress * (3 - 2 * this.progress);
    for (const { leaf, side } of this.leaves) leaf.position.x = side * eased * (this.width / 2 - 0.1);
    this.collider.enabled = this.progress < 0.65;
  }
}

// ---------------------------------------------------------------------------
// Keycard — a spinning card above a hologram projector pillar.
// ---------------------------------------------------------------------------
export class Keycard {
  constructor(level, { position, color, name, onCollect }) {
    this.level = level;
    this.name = name;
    this.color = new THREE.Color(color);
    this.collected = false;
    this.onCollect = onCollect;
    this.group = new THREE.Group();
    this.group.name = `Keycard-${name}`;
    this.group.position.copy(position);
    this.basePosition = position.clone();

    const cardMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.4 });
    this.card = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.22, 0.02, 2, 0.01), cardMat);
    this.card.position.y = 0.9;
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.025), new THREE.MeshStandardMaterial({ color: 0xffd36b, metalness: 1, roughness: 0.2 }));
    chip.position.set(-0.08, 0.02, 0);
    this.card.add(chip);
    this.group.add(this.card);

    this.holo = createHologramMaterial(color, 0.6);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 20, 1, true), this.holo);
    beam.position.y = 0.45;
    this.group.add(beam);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0x20262e, metalness: 0.8, roughness: 0.3 }));
    base.position.y = 0.04;
    base.receiveShadow = true;
    this.group.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.015, 8, 32), emissive(color, 3));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.085;
    this.group.add(ring);
    this.beam = beam;
    level.add(this.group);

    this.interactable = level.addInteractable({
      position: _v.copy(position).setY(position.y + 0.9).clone(),
      radius: 2.0,
      prompt: `Take ${name} keycard`,
      enabled: () => !this.collected,
      onInteract: () => this.collect()
    });
    level.addMarker(this.group, '#' + this.color.getHexString(), 'diamond', { visible: () => !this.collected });
    level.addScanTarget(this.interactable.position, `${name} KEYCARD`, '#' + this.color.getHexString(), () => !this.collected);
  }

  collect() {
    if (this.collected) return;
    this.collected = true;
    this.collectTime = 0;
    audio.play('keycard');
    this.level.game.player.rig.triggerReach();
    this.onCollect?.(this);
  }

  update(dt, t) {
    this.holo.uniforms.uTime.value = t;
    if (!this.collected) {
      this.card.rotation.y += dt * 1.6;
      this.card.position.y = 0.9 + Math.sin(t * 2) * 0.06;
      return;
    }
    // Fly up and shrink into the player.
    if (this.collectTime < 1) {
      this.collectTime += dt * 2.2;
      const s = Math.max(0.001, 1 - this.collectTime);
      this.card.scale.setScalar(s);
      this.card.position.y += dt * 2;
      this.card.rotation.y += dt * 12;
      this.beam.scale.set(s, 1, s);
      this.holo.uniforms.uOpacity.value = s * 0.6;
    } else {
      this.group.visible = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Steam vent — cycles idle → warning hiss → scalding burst.
// ---------------------------------------------------------------------------
export class SteamVent {
  constructor(level, { position, direction = new THREE.Vector3(0, 1, 0), length = 3.2, period = 4, burst = 1.4, offset = 0, radius = 0.8, size = 1.6, growth = 0.15, silent = false }) {
    this.level = level;
    this.position = position.clone();
    this.direction = direction.clone().normalize();
    this.length = length;
    this.period = period;
    this.burstTime = burst;
    this.warnTime = 1.0;
    this.offset = offset;
    this.radius = radius;
    this.growth = growth;
    this.silent = silent;
    this.state = 'idle';

    this.group = new THREE.Group();
    this.group.position.copy(position);
    // Grate housing faces along the vent direction.
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x2b3138, metalness: 0.8, roughness: 0.45 });
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.75, radius * 0.85, 0.12, 24), housingMat);
    housing.receiveShadow = true;
    this.warnMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.0, toneMapped: false });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.62, 24), this.warnMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.065;
    const holder = new THREE.Group();
    holder.add(housing, glow);
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.2, 0.03, 0.05), housingMat);
      bar.position.set(0, 0.075, i * radius * 0.22);
      holder.add(bar);
    }
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.direction);
    this.group.add(holder);

    this.material = createSteamMaterial(textures.softDot(), { length, spread: radius * 0.9, size });
    this.material.uniforms.uDir.value.copy(this.direction);
    this.points = new THREE.Points(createSteamGeometry(140), this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    level.add(this.group);

    level.addMarker(this.group, '#ff7a1a', 'hazard', { pulse: () => this.state === 'burst' });
  }

  phaseTime(t) {
    return ((t + this.offset) % this.period + this.period) % this.period;
  }

  update(dt, t) {
    const p = this.phaseTime(t);
    const idleEnd = this.period - this.burstTime - this.warnTime;
    let state;
    let burst;
    if (p < idleEnd) {
      state = 'idle';
      burst = 0.0;
    } else if (p < idleEnd + this.warnTime) {
      state = 'warn';
      burst = ((p - idleEnd) / this.warnTime) * 0.3;
    } else {
      state = 'burst';
      const k = (p - idleEnd - this.warnTime) / this.burstTime;
      burst = k < 0.1 ? 0.3 + k * 7 : 1 - Math.max(0, k - 0.8) * 3;
    }
    const near = !this.silent && this.level.game.player.position.distanceTo(this.position) < 16;
    if (state !== this.state && near) {
      if (state === 'warn') audio.play('steamWarn', { position: this.position, volume: 0.6 });
      if (state === 'burst') audio.play('steam', { position: this.position, volume: 0.8 });
    }
    this.state = state;
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uBurst.value = burst;
    this.warnMat.opacity = state === 'warn' ? 0.4 + 0.4 * Math.sin(t * 30) : state === 'burst' ? 0.8 : 0.08;
  }

  // Is a point (the player's body) inside the scalding column right now?
  hits(feet, height) {
    if (this.state !== 'burst') return false;
    const d = this.direction;
    // Test a few points up the robot's body against the steam cylinder.
    for (let k = 0.15; k <= 0.95; k += 0.4) {
      _v.set(feet.x, feet.y + height * k, feet.z).sub(this.position);
      const along = _v.dot(d);
      if (along < -0.2 || along > this.length * 0.9) continue;
      const perp = Math.sqrt(Math.max(0, _v.lengthSq() - along * along));
      if (perp < this.radius + 0.15 + along * this.growth) return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Data-log terminal: an animated screen; reading it opens a story log.
// ---------------------------------------------------------------------------
export class Terminal {
  constructor(level, { x, z, rotationY = 0, log, color = '#37c8ff' }) {
    this.level = level;
    this.log = log;
    this.read = false;
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.group.rotation.y = rotationY;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x323a44, metalness: 0.7, roughness: 0.4 });
    const stand = new THREE.Mesh(new RoundedBoxGeometry(0.7, 1.0, 0.45, 2, 0.04), bodyMat);
    stand.position.y = 0.5;
    stand.castShadow = stand.receiveShadow = true;
    const top = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.55, 0.12, 2, 0.03), bodyMat);
    // The terminal faces local +z; the screen housing tilts back by 0.35 rad.
    top.position.set(0, 1.22, 0);
    top.rotation.x = -0.35;
    top.castShadow = true;
    this.screenTex = makeLabelTexture(['DATA LOG', log.id, '▶ PRESS E'], {
      width: 256, height: 160, color, border: color, font: '700 26px Orbitron, sans-serif'
    });
    this.screenMat = new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.43), this.screenMat);
    // Offset along the housing's tilted normal (0, sin .35, cos .35).
    screen.position.set(0, 1.22 + 0.065 * 0.343, 0.065 * 0.939);
    screen.rotation.x = -0.35;
    this.group.add(stand, top, screen);
    level.add(this.group);
    const worldPos = new THREE.Vector3(x, 1.1, z);
    level.physics.addCentered(x, 0.6, z, 0.75, 1.2, 0.75, { minimap: true });
    level.addInteractable({
      position: worldPos,
      radius: 2.0,
      prompt: () => (this.read ? 'Re-read data log' : 'Read data log'),
      onInteract: () => {
        if (!this.read) {
          this.read = true;
          this.screenTex.userData.redraw(['DATA LOG', log.id, '✓ READ'], { color: '#37ff8b', border: '#37ff8b' });
          level.game.collectLog(log);
        }
        audio.play('log');
        level.game.showLog(log);
      }
    });
    level.addMarker(worldPos, color, 'square', { visible: () => !this.read });
    level.addScanTarget(worldPos, 'DATA LOG', color, () => !this.read);
  }
}

// ---------------------------------------------------------------------------
// Floating pickup: battery cell or repair kit. Collected by touching it.
// ---------------------------------------------------------------------------
export class Pickup {
  constructor(level, { position, kind }) {
    this.level = level;
    this.kind = kind;
    this.taken = false;
    this.position = position.clone();
    this.group = new THREE.Group();
    this.group.position.copy(position);
    const color = kind === 'battery' ? 0xffd43b : 0x37ff8b;
    if (kind === 'battery') {
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.32, 16), new THREE.MeshStandardMaterial({ color: 0x1d2228, metalness: 0.7, roughness: 0.3 }));
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.12, 16), emissive(color, 2.5));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.2 }));
      cap.position.y = 0.18;
      this.group.add(cell, band, cap);
    } else {
      const mat = emissive(color, 2.2);
      const a = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.11, 0.11, 2, 0.03), mat);
      const b = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.34, 0.11, 2, 0.03), mat);
      this.group.add(a, b);
    }
    this.halo = createHologramMaterial(color, 0.35);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), this.halo);
    this.group.add(halo);
    level.add(this.group);
    level.addMarker(this.group, '#' + new THREE.Color(color).getHexString(), 'dot', { visible: () => !this.taken });
    level.addScanTarget(this.position, kind === 'battery' ? 'BATTERY' : 'REPAIR KIT', '#' + new THREE.Color(color).getHexString(), () => !this.taken);
  }

  update(dt, t) {
    if (this.taken) return;
    this.halo.uniforms.uTime.value = t;
    this.group.rotation.y += dt * 1.5;
    this.group.position.y = this.position.y + Math.sin(t * 2.5 + this.position.x) * 0.08;
    const player = this.level.game.player;
    _v.copy(player.position);
    _v.y += 0.6;
    if (_v.distanceTo(this.group.position) < 0.9) {
      this.taken = true;
      this.group.visible = false;
      audio.play('pickup');
      if (this.kind === 'battery') {
        player.battery = 100;
        this.level.game.ui.toast('Flashlight battery recharged');
      } else {
        player.heal(50);
        this.level.game.ui.toast('Chassis repaired +50');
      }
    }
  }
}

// Wall sign with glowing text.
export function makeSign(level, text, { x, y, z, rotationY = 0, width = 2, height = 0.45, color = '#37c8ff' }) {
  const tex = makeLabelTexture(text, { width: 512, height: Math.round(512 * height / width), border: color, color });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;
  level.add(mesh);
  return mesh;
}
