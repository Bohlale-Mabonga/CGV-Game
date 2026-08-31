import * as THREE from 'three';

export class PlayerControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.moveSpeed = 3.5;
    this.lookSpeed = 0.0025;

    this.bounds = null;

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

  update(delta) {
    const speed = this.moveSpeed * delta;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, this.camera.up).normalize();

    if (this.keys.forward) this.camera.position.addScaledVector(forward, speed);
    if (this.keys.back) this.camera.position.addScaledVector(forward, -speed);
    if (this.keys.left) this.camera.position.addScaledVector(right, -speed);
    if (this.keys.right) this.camera.position.addScaledVector(right, speed);

    this._applyBounds();
  }
}