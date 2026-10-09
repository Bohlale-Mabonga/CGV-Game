// Lightweight kinematic physics for a character in a box-built world.
//
// The world is a list of axis-aligned boxes. The robot is an upright box
// (radius × height) that is integrated with gravity and resolved one axis at a
// time (X, Z, then Y), which gives stable sliding along walls. Low obstacles
// are climbed automatically (stairs), and the body snaps down onto steps when
// walking downhill so it does not "bounce" off every stair.

import * as THREE from 'three';

const EPS = 0.001;

export class PhysicsWorld {
  constructor() {
    this.colliders = [];
  }

  addBox(minX, minY, minZ, maxX, maxY, maxZ, opts = {}) {
    const collider = {
      min: new THREE.Vector3(Math.min(minX, maxX), Math.min(minY, maxY), Math.min(minZ, maxZ)),
      max: new THREE.Vector3(Math.max(minX, maxX), Math.max(minY, maxY), Math.max(minZ, maxZ)),
      enabled: opts.enabled ?? true,
      tag: opts.tag ?? 'solid',
      blocksSight: opts.blocksSight ?? true,
      minimap: opts.minimap ?? true,
      data: opts.data ?? null
    };
    this.colliders.push(collider);
    return collider;
  }

  // Annulus (ring) collider around a vertical axis: curved walls and ring
  // catwalks. `gaps` are angular openings: [{ angle, half }] in radians.
  addRing(cx, cz, rInner, rOuter, minY, maxY, opts = {}) {
    const collider = this.addBox(cx - rOuter, minY, cz - rOuter, cx + rOuter, maxY, cz + rOuter, { ...opts, minimap: false });
    collider.shape = 'ring';
    collider.cx = cx;
    collider.cz = cz;
    collider.rInner = rInner;
    collider.rOuter = rOuter;
    collider.gaps = opts.gaps ?? [];
    collider.blocksSight = opts.blocksSight ?? false;
    return collider;
  }

  // Centre/size convenience.
  addCentered(cx, cy, cz, sx, sy, sz, opts) {
    return this.addBox(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2, opts);
  }

  remove(collider) {
    const i = this.colliders.indexOf(collider);
    if (i >= 0) this.colliders.splice(i, 1);
  }

  clear() {
    this.colliders.length = 0;
  }

  // Slab-method ray/AABB test against every enabled collider.
  // Returns the distance to the first hit, or Infinity.
  raycast(origin, dir, maxDist = Infinity, filter = null) {
    let best = maxDist;
    const ix = 1 / (dir.x || 1e-9), iy = 1 / (dir.y || 1e-9), iz = 1 / (dir.z || 1e-9);
    for (const c of this.colliders) {
      if (!c.enabled || c.shape === 'ring' || (filter && !filter(c))) continue;
      let t1 = (c.min.x - origin.x) * ix, t2 = (c.max.x - origin.x) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (c.min.y - origin.y) * iy; t2 = (c.max.y - origin.y) * iy;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (c.min.z - origin.z) * iz; t2 = (c.max.z - origin.z) * iz;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax >= Math.max(tmin, 0) && tmin < best) best = Math.max(tmin, 0);
    }
    return best;
  }

  // Line-of-sight test between two points (used by the security turret).
  isOccluded(from, to, filter = (c) => c.blocksSight) {
    const dir = _tmpDir.subVectors(to, from);
    const dist = dir.length();
    if (dist < 1e-4) return false;
    dir.divideScalar(dist);
    return this.raycast(from, dir, dist - 0.05, filter) < dist - 0.05;
  }
}

const _tmpDir = new THREE.Vector3();

export class CharacterBody {
  constructor(world) {
    this.world = world;
    this.position = new THREE.Vector3(); // feet
    this.velocity = new THREE.Vector3();
    this.radius = 0.32;
    this.standHeight = 1.2;
    this.crouchHeight = 0.72;
    this.height = this.standHeight;
    this.stepHeight = 0.45;
    this.gravity = -24;
    this.grounded = false;
    this.groundCollider = null;
    this.hitWall = false;
    this.landingSpeed = 0;
  }

  overlaps(c, x, y, z, h = this.height) {
    const r = this.radius;
    if (c.shape === 'ring') {
      if (!(y < c.max.y - EPS && y + h > c.min.y + EPS)) return false;
      const d = Math.hypot(x - c.cx, z - c.cz);
      if (!(d + r > c.rInner + EPS && d - r < c.rOuter - EPS)) return false;
      if (c.gaps.length) {
        const a = Math.atan2(z - c.cz, x - c.cx);
        for (const g of c.gaps) {
          let diff = Math.abs(a - g.angle) % (Math.PI * 2);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff < g.half) return false;
        }
      }
      return true;
    }
    return (
      x - r < c.max.x - EPS && x + r > c.min.x + EPS &&
      y < c.max.y - EPS && y + h > c.min.y + EPS &&
      z - r < c.max.z - EPS && z + r > c.min.z + EPS
    );
  }

  blockedAt(x, y, z, h = this.height) {
    for (const c of this.world.colliders) {
      if (c.enabled && c.tag !== 'trigger' && this.overlaps(c, x, y, z, h)) return true;
    }
    return false;
  }

  canStand() {
    return !this.blockedAt(this.position.x, this.position.y, this.position.z, this.standHeight);
  }

  step(dt) {
    const wasGrounded = this.grounded;
    this.velocity.y += this.gravity * dt;
    this.velocity.y = Math.max(this.velocity.y, -40);

    // Sub-step so fast motion (jump pads) never tunnels through thin floors.
    const travel = Math.max(Math.abs(this.velocity.x), Math.abs(this.velocity.y), Math.abs(this.velocity.z)) * dt;
    const steps = Math.min(8, Math.max(1, Math.ceil(travel / 0.12)));
    const h = dt / steps;

    this.grounded = false;
    this.hitWall = false;
    this.landingSpeed = 0;
    for (let i = 0; i < steps; i++) {
      this.moveAxis('x', this.velocity.x * h, wasGrounded);
      this.moveAxis('z', this.velocity.z * h, wasGrounded);
      this.moveAxis('y', this.velocity.y * h, wasGrounded);
    }

    // Snap down onto stairs / slopes when we were grounded last frame.
    if (wasGrounded && !this.grounded && this.velocity.y <= 0) {
      const p = this.position;
      for (let probe = 0.05; probe <= this.stepHeight + 0.01; probe += 0.05) {
        if (this.blockedAt(p.x, p.y - probe, p.z)) {
          const top = this.groundTopBelow(p.x, p.y, p.z);
          if (top !== null) {
            p.y = top;
            this.grounded = true;
            this.velocity.y = 0;
          }
          break;
        }
      }
    }
  }

  groundTopBelow(x, y, z) {
    let best = null;
    for (const c of this.world.colliders) {
      if (!c.enabled || c.tag === 'trigger') continue;
      const r = this.radius;
      let under;
      if (c.shape === 'ring') {
        const d = Math.hypot(x - c.cx, z - c.cz);
        under = d + r > c.rInner && d - r < c.rOuter;
      } else {
        under = x - r < c.max.x && x + r > c.min.x && z - r < c.max.z && z + r > c.min.z;
      }
      if (under) {
        if (c.max.y <= y + EPS && c.max.y >= y - this.stepHeight - 0.05) {
          if (best === null || c.max.y > best) best = c.max.y;
        }
      }
    }
    return best;
  }

  moveAxis(axis, amount, wasGrounded) {
    if (amount === 0) {
      if (axis !== 'y') return;
    }
    const p = this.position;
    p[axis] += amount;
    for (const c of this.world.colliders) {
      if (!c.enabled || c.tag === 'trigger') continue;
      if (!this.overlaps(c, p.x, p.y, p.z)) continue;

      if (axis === 'y') {
        if (amount <= 0) {
          this.landingSpeed = Math.max(this.landingSpeed, -this.velocity.y);
          p.y = c.max.y;
          this.velocity.y = 0;
          this.grounded = true;
          this.groundCollider = c;
        } else {
          p.y = c.min.y - this.height - EPS;
          this.velocity.y = Math.min(0, this.velocity.y);
        }
        continue;
      }

      // Horizontal hit: try stepping up onto low obstacles first.
      const rise = c.max.y - p.y;
      if ((wasGrounded || this.grounded) && rise > 0 && rise <= this.stepHeight &&
          !this.blockedAt(p.x, c.max.y + EPS, p.z)) {
        p.y = c.max.y + EPS;
        continue;
      }
      if (c.shape === 'ring') {
        // Push radially to whichever face of the annulus is nearer.
        const dx = p.x - c.cx, dz = p.z - c.cz;
        const d = Math.hypot(dx, dz) || 1e-6;
        const target = d < (c.rInner + c.rOuter) / 2 ? c.rInner - this.radius - EPS : c.rOuter + this.radius + EPS;
        p.x = c.cx + (dx / d) * target;
        p.z = c.cz + (dz / d) * target;
        const radial = (this.velocity.x * dx + this.velocity.z * dz) / d;
        if ((target < d && radial > 0) || (target > d && radial < 0)) {
          this.velocity.x -= (dx / d) * radial;
          this.velocity.z -= (dz / d) * radial;
        }
        this.hitWall = true;
        continue;
      }
      if (amount > 0) p[axis] = c.min[axis] - this.radius - EPS;
      else p[axis] = c.max[axis] + this.radius + EPS;
      this.velocity[axis] = 0;
      this.hitWall = true;
    }
  }
}

export function pointInBox(p, box) {
  return p.x >= box.min.x && p.x <= box.max.x &&
    p.y >= box.min.y && p.y <= box.max.y &&
    p.z >= box.min.z && p.z <= box.max.z;
}

export function makeZone(minX, minY, minZ, maxX, maxY, maxZ) {
  return {
    min: new THREE.Vector3(minX, minY, minZ),
    max: new THREE.Vector3(maxX, maxY, maxZ)
  };
}
