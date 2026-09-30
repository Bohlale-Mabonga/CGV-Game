import * as THREE from "three";

const FIRST_PERSON = "first-person";
const THIRD_PERSON = "third-person";

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);

const DEFAULT_OPTIONS = {
  distance: 1,
  shoulderHeight: 0.2,
  lookAhead: 2,
  followSpeed: 14,
  minPitch: -Math.PI / 3,
  maxPitch: Math.PI / 3,
  collisionPadding: 0.25,
};

/**
 * Holds both cameras and swaps between them.
 *
 * The first-person camera stays the authoritative player transform: controls
 * move it and hazards teleport it. The third-person camera is derived from it
 * every frame, so switching modes never disturbs player position.
 */
export class CameraRig {
  constructor(playerCamera, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    this.player = playerCamera;
    this.mode = FIRST_PERSON;

    this.distance = opts.distance;
    this.shoulderHeight = opts.shoulderHeight;
    this.lookAhead = opts.lookAhead;
    this.followSpeed = opts.followSpeed;
    this.minPitch = opts.minPitch;
    this.maxPitch = opts.maxPitch;
    this.collisionPadding = opts.collisionPadding;

    this.occluders = opts.occluders ?? [];

    this.third = new THREE.PerspectiveCamera(
      playerCamera.fov,
      playerCamera.aspect,
      playerCamera.near,
      playerCamera.far,
    );
    this.third.position.copy(playerCamera.position);

    // scratch objects so update() doesn't allocate every frame
    this._euler = new THREE.Euler(0, 0, 0, "YXZ");
    this._direction = new THREE.Vector3();
    this._pivot = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._ray = new THREE.Raycaster();

    document.addEventListener("keydown", (e) => {
      if (e.code === "KeyC" && !e.repeat) this.toggle();
    });
  }

  get isThirdPerson() {
    return this.mode === THIRD_PERSON;
  }

  /** The camera the renderer should draw with. */
  get active() {
    return this.isThirdPerson ? this.third : this.player;
  }

  toggle() {
    this.setMode(this.isThirdPerson ? FIRST_PERSON : THIRD_PERSON);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (!this.isThirdPerson) return;

    // snap instead of sweeping in from the old position
    this._solve(this._desired, this._look);
    this.third.position.copy(this._desired);
    this.third.lookAt(this._look);
  }

  setOccluders(objects) {
    this.occluders = objects;
  }

  setAspect(aspect) {
    this.player.aspect = aspect;
    this.player.updateProjectionMatrix();
    this.third.aspect = aspect;
    this.third.updateProjectionMatrix();
  }

  _solve(desired, look) {
    this._euler.setFromQuaternion(this.player.quaternion, "YXZ");
    this._euler.x = Math.max(
      this.minPitch,
      Math.min(this.maxPitch, this._euler.x),
    );
    this._direction.copy(FORWARD).applyEuler(this._euler);

    this._pivot
      .copy(this.player.position)
      .addScaledVector(UP, this.shoulderHeight);
    desired.copy(this._pivot).addScaledVector(this._direction, -this.distance);
    look.copy(this._pivot).addScaledVector(this._direction, this.lookAhead);

    this._pullInPastWalls(desired);
  }

  // Pull the camera forward along the boom so walls and doors don't clip it.
  _pullInPastWalls(desired) {
    if (this.occluders.length === 0) return;

    this._offset.copy(desired).sub(this._pivot);
    const length = this._offset.length();
    if (length < 1e-4) return;
    this._offset.divideScalar(length);

    this._ray.set(this._pivot, this._offset);
    this._ray.far = length;

    const hits = this._ray.intersectObjects(this.occluders, true);
    if (hits.length === 0) return;

    const hitDistance = Math.max(0.1, hits[0].distance - this.collisionPadding);
    desired.copy(this._pivot).addScaledVector(this._offset, hitDistance);
  }

  update(delta) {
    if (!this.isThirdPerson) return;

    this._solve(this._desired, this._look);

    const t = 1 - Math.exp(-this.followSpeed * delta);
    this.third.position.lerp(this._desired, t);
    this.third.lookAt(this._look);
  }
}
