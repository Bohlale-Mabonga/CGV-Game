import * as THREE from 'three';

export class PlayerControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.moveSpeed = 3.5;
    this.lookSpeed = 0.0025;

    this.bounds = null;
    this.collisionRadius = 0.35;
    this.obstacles = [];

    this.keys = {
      forward: false,
      back: false,
      left: false,
      right: false
    };

    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.isLocked = false;

    document.addEventListener('keydown', (e) => this._onKeyDown(e));
    document.addEventListener('keyup', (e) => this._onKeyUp(e));
    document.addEventListener('mousemove', (e) => this._onMouseMove(e));

    domElement.addEventListener('click', () => {
      domElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === domElement;
    });
  }

  setBounds(bounds) {
    this.bounds = bounds;
  }

  setObstacles(obstacles) {
    this.obstacles = obstacles;
  }

  _onKeyDown(e) {
    if (e.code === 'KeyW') this.keys.forward = true;
    if (e.code === 'KeyS') this.keys.back = true;
    if (e.code === 'KeyA') this.keys.left = true;
    if (e.code === 'KeyD') this.keys.right = true;
  }

  _onKeyUp(e) {
    if (e.code === 'KeyW') this.keys.forward = false;
    if (e.code === 'KeyS') this.keys.back = false;
    if (e.code === 'KeyA') this.keys.left = false;
    if (e.code === 'KeyD') this.keys.right = false;
  }

  _onMouseMove(e) {
    if (!this.isLocked) return;

    this.euler.setFromQuaternion(this.camera.quaternion);

    this.euler.y -= e.movementX * this.lookSpeed;
    this.euler.x -= e.movementY * this.lookSpeed;

    this.euler.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, this.euler.x)
    );

    this.camera.quaternion.setFromEuler(this.euler);
  }

  _applyBounds() {
    if (!this.bounds) return;

    this.camera.position.x = THREE.MathUtils.clamp(
      this.camera.position.x,
      this.bounds.minX,
      this.bounds.maxX
    );

    this.camera.position.z = THREE.MathUtils.clamp(
      this.camera.position.z,
      this.bounds.minZ,
      this.bounds.maxZ
    );
  }

  _collidesWithObstacle(position) {
    for (const obstacle of this.obstacles) {
      if (obstacle.userData.ignoreCollision) continue;

      const box = new THREE.Box3().setFromObject(obstacle);

      const closestPoint = box.clampPoint(position, new THREE.Vector3());
      const distance = closestPoint.distanceTo(position);

      if (distance < this.collisionRadius) {
        return true;
      }
    }

    return false;
  }

  _tryMove(moveVector) {
    if (moveVector.lengthSq() === 0) return;

    const originalPosition = this.camera.position.clone();

    this.camera.position.add(moveVector);
    this._applyBounds();

    if (this._collidesWithObstacle(this.camera.position)) {
      this.camera.position.copy(originalPosition);
    }
  }

  update(delta) {
    const speed = this.moveSpeed * delta;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, this.camera.up).normalize();

    if (this.keys.forward) this._tryMove(forward.clone().multiplyScalar(speed));
    if (this.keys.back) this._tryMove(forward.clone().multiplyScalar(-speed));
    if (this.keys.left) this._tryMove(right.clone().multiplyScalar(-speed));
    if (this.keys.right) this._tryMove(right.clone().multiplyScalar(speed));
  }
}