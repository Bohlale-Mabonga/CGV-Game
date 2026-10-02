import * as THREE from "three";

export class PlayerControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.moveSpeed = 2;
    this.lookSpeed = 0.0025;

    this.body = null; // Body from the player, e.g. robot.body
    this.keys = { forward: false, back: false, left: false, right: false };
    this.euler = new THREE.Euler(0, 0, 0, "YXZ");
    this.isLocked = false;

    // scratch objects so update() doesn't allocate every frame
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._move = new THREE.Vector3();

    document.addEventListener("keydown", (e) => this._setKey(e.code, true));
    document.addEventListener("keyup", (e) => this._setKey(e.code, false));
    document.addEventListener("mousemove", (e) => this._onMouseMove(e));

    domElement.addEventListener("click", () => domElement.requestPointerLock());
    document.addEventListener("pointerlockchange", () => {
      this.isLocked = document.pointerLockElement === domElement;
    });
  }

  getYaw() {
    return this.euler.y;
  }

  setBody(body) {
    this.body = body;
  }

  _setKey(code, down) {
    if (code === "KeyW") this.keys.forward = down;
    if (code === "KeyS") this.keys.back = down;
    if (code === "KeyA") this.keys.left = down;
    if (code === "KeyD") this.keys.right = down;
  }

  _onMouseMove(e) {
    if (!this.isLocked) return;

    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= e.movementX * this.lookSpeed;
    this.euler.x -= e.movementY * this.lookSpeed;
    this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  // The robot body decides which positions are legal; each axis is resolved
  // separately so you slide along walls instead of sticking.
  _tryMove(move) {
    if (this.body === null) {
      throw new Error("PlayerControls: setBody() must be called before moving.");
    }
    this.body.move(this.camera.position, move.x, move.z);
  }

  update(delta) {
    const { forward, back, left, right } = this.keys;
    const fwd = (forward ? 1 : 0) - (back ? 1 : 0);
    const side = (right ? 1 : 0) - (left ? 1 : 0);
    if (!fwd && !side) return;

    this.camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    this._forward.normalize();
    this._right.crossVectors(this._forward, this.camera.up).normalize();

    // one combined vector, normalized, so diagonals aren't faster
    this._move
      .set(0, 0, 0)
      .addScaledVector(this._forward, fwd)
      .addScaledVector(this._right, side)
      .normalize()
      .multiplyScalar(this.moveSpeed * delta);

    this._tryMove(this._move);
  }
}
