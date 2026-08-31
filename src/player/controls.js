import * as THREE from 'three';

// Simple WASD and mouse-look controller.
export class PlayerControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.moveSpeed = 3.5;
    this.lookSpeed = 0.0025;

    this.keys = { forward: false, back: false, left: false, right: false };
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.isLocked = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onClick = this._onClick.bind(this);

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    domElement.addEventListener('click', this._onClick);
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === domElement;
    });
  }

  _onClick() {
    this.domElement.requestPointerLock();
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': this.keys.forward = true; break;
      case 'KeyS': this.keys.back = true; break;
      case 'KeyA': this.keys.left = true; break;
      case 'KeyD': this.keys.right = true; break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': this.keys.forward = false; break;
      case 'KeyS': this.keys.back = false; break;
      case 'KeyA': this.keys.left = false; break;
      case 'KeyD': this.keys.right = false; break;
    }
  }

  _onMouseMove(e) {
    if (!this.isLocked) return;
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= e.movementX * this.lookSpeed;
    this.euler.x -= e.movementY * this.lookSpeed;
    this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  update(delta) {
    const speed = this.moveSpeed * delta;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up);

    if (this.keys.forward) this.camera.position.addScaledVector(forward, speed);
    if (this.keys.back) this.camera.position.addScaledVector(forward, -speed);
    if (this.keys.left) this.camera.position.addScaledVector(right, -speed);
    if (this.keys.right) this.camera.position.addScaledVector(right, speed);
  }
}
