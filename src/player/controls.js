import * as THREE from 'three';

export class PlayerControls {
  constructor(camera, domElement, playerModel = null) {
    this.camera = camera;
    this.domElement = domElement;
    this.playerModel = playerModel;

    this.moveSpeed = 3.5;
    this.sprintMultiplier = 1.75;
    this.maxStamina = 100;
    this.stamina = this.maxStamina;
    this.staminaDrainRate = 34;
    this.staminaRegenRate = 22;
    this.lookSpeed = 0.0025;

    this.viewMode = 'firstPerson';

    this.playerPosition = camera.position.clone();
    this.yaw = 0;
    this.pitch = 0;

    this.bounds = null;
    this.canMoveTo = null;
    this.collisionBoxes = [];
    this.playerRadius = 0.28;

    this.keys = {
      forward: false,
      back: false,
      left: false,
      right: false,
      sprint: false
    };
    this.isSprinting = false;
    this.onStaminaChange = null;

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

    window.addEventListener('blur', () => {
      for (const key of Object.keys(this.keys)) this.keys[key] = false;
      this.isSprinting = false;
    });

    this._updateCamera();
  }

  setBounds(bounds) {
    this.bounds = bounds;
  }

  setMovementConstraint(callback) {
    this.canMoveTo = callback;
  }

  setCollisionBoxes(collisionBoxes) {
    this.collisionBoxes = collisionBoxes;
  }

  getPlayerPosition() {
    return this.playerPosition;
  }

  getPlayerRotationY() {
    return this.yaw;
  }

  getStamina() {
    return this.stamina;
  }

  respawn(position) {
    this.playerPosition.copy(position);
    this.stamina = this.maxStamina;
    this._updateCamera();
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
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.sprint = true;

    if (e.code === 'KeyV' && !e.repeat) {
      this.toggleViewMode();
    }
  }

  _onKeyUp(e) {
    if (e.code === 'KeyW') this.keys.forward = false;
    if (e.code === 'KeyS') this.keys.back = false;
    if (e.code === 'KeyA') this.keys.left = false;
    if (e.code === 'KeyD') this.keys.right = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.sprint = false;
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
    this._applyBoundsTo(this.playerPosition);
  }

  _applyBoundsTo(position) {
    if (!this.bounds) return;

    position.x = THREE.MathUtils.clamp(
      position.x,
      this.bounds.minX,
      this.bounds.maxX
    );

    position.z = THREE.MathUtils.clamp(
      position.z,
      this.bounds.minZ,
      this.bounds.maxZ
    );
  }

  _hitsCollision(position) {
    return this.collisionBoxes.some((box) => {
      if (box.isActive && !box.isActive()) return false;

      const padding = box.padding ?? this.playerRadius;
      return (
        position.x > box.minX - padding &&
        position.x < box.maxX + padding &&
        position.z > box.minZ - padding &&
        position.z < box.maxZ + padding
      );
    });
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
    const hasMovementInput = this.keys.forward || this.keys.back || this.keys.left || this.keys.right;
    this.isSprinting = Boolean(this.keys.sprint && hasMovementInput && this.stamina > 0);

    if (this.isSprinting) {
      this.stamina = Math.max(0, this.stamina - this.staminaDrainRate * delta);
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate * delta);
    }

    if (this.onStaminaChange) this.onStaminaChange(this.stamina, this.maxStamina, this.isSprinting);

    const speed = this.moveSpeed * (this.isSprinting ? this.sprintMultiplier : 1) * delta;

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

    const movement = new THREE.Vector3();

    if (this.keys.forward) movement.add(forward);
    if (this.keys.back) movement.sub(forward);
    if (this.keys.left) movement.sub(right);
    if (this.keys.right) movement.add(right);

    if (movement.lengthSq() > 0) {
      movement.normalize().multiplyScalar(speed);

      const nextPosition = this.playerPosition.clone().add(movement);
      this._applyBoundsTo(nextPosition);

      const canEnterArea =
        !this.canMoveTo || this.canMoveTo(nextPosition, this.playerPosition);

      if (canEnterArea && !this._hitsCollision(nextPosition)) {
        this.playerPosition.copy(nextPosition);
      }
    }

    this._applyBounds();
    this._updateCamera();
  }
}
