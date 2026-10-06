import * as THREE from "three";

const DEFAULT_OPTIONS = {
  radius: 0.3,
  lowerSphere: 0.2,
  upperSphere: 0.9,
  depenetrationPasses: 4,
};

/**
 * Vertical capsule collider (two spheres on a shared axis) describing the
 * player body.
 *
 * The position is passed in rather than stored, so hazards can keep writing to
 * `camera.position` and the body stays in step with whatever they write.
 */
export class Body {
  constructor({ walkable, obstacles, ...options } = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    this.radius = opts.radius;
    this.depenetrationPasses = opts.depenetrationPasses;

    this.walkable = walkable ?? null; // (x, z) => boolean, e.g. level.isInside
    this.obstacles = obstacles ?? [];

    this._heights = [opts.lowerSphere, opts.upperSphere];
    this._radiusSq = this.radius * this.radius;

    this._box = new THREE.Box3();
    this._closest = new THREE.Vector3();
    this._center = new THREE.Vector3();
    this._push = new THREE.Vector3();
  }

  setWalkable(fn) {
    this.walkable = fn;
  }

  setObstacles(obstacles) {
    this.obstacles = obstacles;
  }

  isBlocked(x, z) {
    return !this._isWalkable(x, z) || this._hitsObstacle(x, z);
  }

  // Each axis is resolved separately so you slide along walls instead of sticking.
  move(position, dx, dz) {
    if (!this.isBlocked(position.x + dx, position.z)) position.x += dx;
    if (!this.isBlocked(position.x, position.z + dz)) position.z += dz;
  }

  /** Shoves the body out of anything it currently overlaps. Returns true if it moved. */
  depenetrate(position) {
    let resolved = false;
    for (let pass = 0; pass < this.depenetrationPasses; pass++) {
      if (!this._pushOut(position)) break;
      resolved = true;
    }
    return resolved;
  }

  // Rooms bound walkable space, so the whole footprint has to fit, not just the centre.
  _isWalkable(x, z) {
    if (!this.walkable) return true;

    const r = this.radius;
    return (
      this.walkable(x, z) &&
      this.walkable(x + r, z) &&
      this.walkable(x - r, z) &&
      this.walkable(x, z + r) &&
      this.walkable(x, z - r)
    );
  }

  _hitsObstacle(x, z) {
    for (const obstacle of this.obstacles) {
      if (obstacle.userData.ignoreCollision) continue;
      this._box.setFromObject(obstacle);

      for (const height of this._heights) {
        this._center.set(x, height, z);
        this._box.clampPoint(this._center, this._closest);
        if (this._closest.distanceToSquared(this._center) < this._radiusSq)
          return true;
      }
    }
    return false;
  }

  _pushOut(position) {
    let moved = false;

    for (const obstacle of this.obstacles) {
      if (obstacle.userData.ignoreCollision) continue;
      this._box.setFromObject(obstacle);

      for (const height of this._heights) {
        this._center.set(position.x, height, position.z);
        this._box.clampPoint(this._center, this._closest);

        if (this._closest.distanceToSquared(this._center) >= this._radiusSq)
          continue;

        if (this._closest.equals(this._center))
          this._escapeThroughNearestFace(position);
        else this._pushOutAlongNormal(position);

        moved = true;
      }
    }

    return moved;
  }

  _pushOutAlongNormal(position) {
    const depth = this.radius - this._closest.distanceTo(this._center);
    this._push.subVectors(this._center, this._closest).normalize();
    position.x += this._push.x * depth;
    position.z += this._push.z * depth;
  }

  // Sphere centre sits inside the box, so there is no surface normal to push along.
  _escapeThroughNearestFace(position) {
    const c = this._center;

    let depth = c.x - this._box.min.x;
    let axisX = -1;
    let axisZ = 0;
    if (this._box.max.x - c.x < depth) {
      depth = this._box.max.x - c.x;
      axisX = 1;
      axisZ = 0;
    }
    if (c.z - this._box.min.z < depth) {
      depth = c.z - this._box.min.z;
      axisX = 0;
      axisZ = -1;
    }
    if (this._box.max.z - c.z < depth) {
      depth = this._box.max.z - c.z;
      axisX = 0;
      axisZ = 1;
    }

    const push = depth + this.radius;
    position.x += axisX * push;
    position.z += axisZ * push;
  }
}
