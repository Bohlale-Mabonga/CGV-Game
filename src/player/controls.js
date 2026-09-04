import * as THREE from 'three';

export class PlayerControls {
  constructor(camera, domElement, playerModel = null) {
    this.camera = camera;
    this.domElement = domElement;
    this.playerModel = playerModel;

    this.moveSpeed = 3.5;
    this.lookSpeed = 0.0025;

    this.viewMode = 'firstPerson';

    this.playerPosition = camera.position.clone();
    this.yaw = 0;
    this.pitch = 0;

    this.bounds = null;

    this.keys = {
      forward: false,
      back: false,
      left: false,
      right: false
    };

    this.isLocked = false;
    this.onViewModeChange = null;

    document.addEventListener('keydown', (e) => this._onKeyDown(e));
    document.addEventListener('keyup', (e) => this._onKeyUp(e));
    document.addEventListener('mousemove', (e) => this._onMouseMove(e));

    domElement.addEventListener('click', () => {
      domElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === domElement;
    });

    this._updateCamera();
  }

  setBounds(bounds) {
    this.bounds = bounds;
  }

  getPlayerPosition() {
    return this.playerPosition;
  }

  toggleViewMode() {
    this.viewMode =
      this.viewMode === 'firstPerson' ? 'thirdPerson' : 'firstPerson';

    if (this.playerModel) {
      this.playerModel.visible = this.viewMode === 'thirdPerson';
    }

    if (this.onViewModeChange) {
      this.onViewModeChange(this.viewMode);
    }

    this._updateCamera();
  }

  _onKeyDown(e) {
    if (e.code === 'KeyW') this.keys.forward = true;
    if (e.code === 'KeyS') this.keys.back = true;
    if (e.code === 'KeyA') this.keys.left = true;
    if (e.code === 'KeyD') this.keys.right = true;

    if (e.code === 'KeyV') {
      this.toggleViewMode();
    }
  }

  _onKeyUp(e) {
    if (e.code === 'KeyW') this.keys.forward = false;
    if (e.code === 'KeyS') this.keys.back = false;
    if (e.code === 'KeyA') this.keys.left = false;
    if (e.code === 'KeyD') this.keys.right = false;
  }

  _onMouseMove(e) {
    if (!this.isLocked) return;

    this.yaw -= e.movementX * this.lookSpeed;
    this.pitch -= e.movementY * this.lookSpeed;

    this.pitch = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, this.pitch)
    );

    this._updateCamera();
  }

  _applyBounds() {
    if (!this.bounds) return;

    this.playerPosition.x = THREE.MathUtils.clamp(
      this.playerPosition.x,
      this.bounds.minX,
      this.bounds.maxX
    );

    this.playerPosition.z = THREE.MathUtils.clamp(
      this.playerPosition.z,
      this.bounds.minZ,
      this.bounds.maxZ
    );
  }

  _updateCamera() {
    if (this.playerModel) {
      this.playerModel.position.set(
        this.playerPosition.x,
        0.75,
        this.playerPosition.z
      );

      this.playerModel.rotation.y = this.yaw;
    }

    if (this.viewMode === 'firstPerson') {
      this.camera.position.copy(this.playerPosition);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      return;
    }
    const distanceBehind = 2.4;
    const heightAbove = 0.45;

    const thirdPersonOffset = new THREE.Vector3(
      Math.sin(this.yaw) * distanceBehind,
      heightAbove,
      Math.cos(this.yaw) * distanceBehind
    );

    this.camera.position.copy(this.playerPosition).add(thirdPersonOffset);

    this.camera.lookAt(
      this.playerPosition.x,
      this.playerPosition.y,
      this.playerPosition.z
    );
  }

  update(delta) {
    const speed = this.moveSpeed * delta;

    const forward = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    );

    const right = new THREE.Vector3(
      Math.cos(this.yaw),
      0,
      -Math.sin(this.yaw)
    );

    if (this.keys.forward) this.playerPosition.addScaledVector(forward, speed);
    if (this.keys.back) this.playerPosition.addScaledVector(forward, -speed);
    if (this.keys.left) this.playerPosition.addScaledVector(right, -speed);
    if (this.keys.right) this.playerPosition.addScaledVector(right, speed);

    this._applyBounds();
    this._updateCamera();
  }
}