// The player: SPARK's physics body, controls, cameras, flashlight and vitals.

import * as THREE from 'three';
import { CharacterBody } from '../engine/physics.js';
import { settings } from '../engine/settings.js';
import { audio } from '../engine/audio.js';
import { buildProceduralRobot, buildViewArms, RobotRig } from './robot.js';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export class Player {
  constructor(game, camera) {
    this.game = game;
    this.camera = camera;
    this.input = game.input;
    this.body = new CharacterBody(game.physics);

    this.yaw = 0;
    this.pitch = 0;
    this.viewMode = 'first';
    this.tpDistance = 3.2;
    this.tpCurrent = 3.2;

    this.maxIntegrity = 100;
    this.integrity = 100;
    this.stamina = 100;
    this.battery = 100;
    this.flashlightOn = true;
    this.crouching = false;
    this.abilities = { doubleJump: false };
    this.usedDoubleJump = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.invulnerable = 0;
    this.hurtTimer = 0;
    this.frozen = false;
    this.trauma = 0; // camera shake amount, decays over time
    this.stepDistance = 0;
    this.bobPhase = 0;
    this.landDip = 0;
    this.thrust = 0;
    this.distanceTravelled = 0;
    this.launchTimer = 0; // keeps jump-pad momentum by reducing air drag
    this.exhausted = false;

    // Avatar.
    const { root, materials } = buildProceduralRobot();
    this.robot = root;
    this.rig = new RobotRig(root, materials);
    game.scene.add(root);

    // First-person arms ride on the camera.
    this.viewArms = buildViewArms();
    this.viewArms.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.depthTest = false;
      }
    });
    camera.add(this.viewArms);

    // Flashlight rig follows the head, independent of avatar visibility.
    this.flashRig = new THREE.Object3D();
    this.flashlight = new THREE.SpotLight(0xdff2ff, 110, 30, 0.52, 0.45, 1.5);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.camera.near = 0.2;
    this.flashlight.shadow.camera.far = 28;
    this.flashlight.shadow.bias = -0.0008;
    this.flashlight.shadow.normalBias = 0.02;
    this.flashlight.position.set(0, 0, -0.32);
    this.flashTarget = new THREE.Object3D();
    this.flashTarget.position.set(0, 0, -5);
    this.flashlight.target = this.flashTarget;
    this.flashRig.add(this.flashlight, this.flashTarget);
    // A faint fill light so the robot's surroundings are never pitch black.
    this.fillLight = new THREE.PointLight(0x5fb8ff, 1.2, 5, 2);
    this.fillLight.position.set(0, 0.3, 0);
    this.flashRig.add(this.fillLight);
    game.scene.add(this.flashRig);

    this.setViewMode('first', true);
  }

  swapRobotModel(model) {
    this.game.scene.remove(this.robot);
    this.robot.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
    this.robot = model;
    this.rig.setModel(model, this.rig.materials);
    this.game.scene.add(model);
    this.robot.visible = this.viewMode === 'third';
  }

  get position() {
    return this.body.position;
  }

  get eyeHeight() {
    return this.crouching ? 0.62 : 1.02;
  }

  headPosition(target = new THREE.Vector3()) {
    return target.set(this.body.position.x, this.body.position.y + this.eyeHeight, this.body.position.z);
  }

  forward(target = new THREE.Vector3()) {
    return target.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  lookDirection(target = new THREE.Vector3()) {
    _euler.set(this.pitch, this.yaw, 0);
    return target.set(0, 0, -1).applyEuler(_euler);
  }

  spawn(position, yaw = 0, restore = true) {
    this.body.position.copy(position);
    this.body.velocity.set(0, 0, 0);
    this.body.height = this.body.standHeight;
    this.crouching = false;
    this.yaw = yaw;
    this.pitch = 0;
    if (restore || this.integrity <= 0) this.integrity = this.maxIntegrity;
    this.stamina = 100;
    this.invulnerable = 1.0;
    this.hurtTimer = 0;
    this.usedDoubleJump = false;
    this.trauma = 0;
    this.updateCamera(0);
  }

  setViewMode(mode, silent = false) {
    this.viewMode = mode;
    this.robot.visible = mode === 'third';
    this.viewArms.visible = mode === 'first';
    if (!silent) this.game.ui.toast(mode === 'first' ? 'First-person view' : 'Third-person view');
  }

  toggleView() {
    this.setViewMode(this.viewMode === 'first' ? 'third' : 'first');
  }

  toggleFlashlight() {
    if (!this.flashlightOn && this.battery < 3) {
      audio.play('error');
      this.game.ui.toast('Flashlight battery depleted — let it recharge');
      return;
    }
    this.flashlightOn = !this.flashlightOn;
    audio.play('flashlight');
  }

  addShake(amount) {
    if (!settings.get('motionFx')) amount *= 0.25;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  damage(amount, source = null, knockback = 6, reason = 'Critical damage') {
    if (this.invulnerable > 0 || this.game.state !== 'playing') return false;
    const scaled = amount * settings.difficulty.damageScale;
    this.integrity = Math.max(0, this.integrity - scaled);
    this.invulnerable = 0.9;
    this.hurtTimer = 0.6;
    this.addShake(0.55);
    this.game.fxPulse('damage', 1);
    audio.play('damage');
    this.game.stats.damageTaken += scaled;
    if (source) {
      const away = _wish.subVectors(this.body.position, source);
      away.y = 0;
      if (away.lengthSq() < 1e-4) away.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      away.normalize().multiplyScalar(knockback);
      this.body.velocity.x = away.x;
      this.body.velocity.z = away.z;
      this.body.velocity.y = Math.max(this.body.velocity.y, knockback * 0.45);
    }
    if (this.integrity <= 0) this.game.playerDown(reason);
    return true;
  }

  heal(amount) {
    this.integrity = Math.min(this.maxIntegrity, this.integrity + amount);
  }

  update(dt) {
    const input = this.input;
    const body = this.body;

    // ---- look ----------------------------------------------------------
    const { dx, dy } = input.consumeMouse();
    const sens = 0.0022 * settings.get('sensitivity');
    if (!this.frozen) {
      this.yaw -= dx * sens;
      this.pitch -= dy * sens * (settings.get('invertY') ? -1 : 1);
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
    }
    const wheel = input.consumeWheel();
    if (wheel) {
      this.tpDistance = THREE.MathUtils.clamp(this.tpDistance + wheel * 0.4, 1.6, 6);
      if (this.viewMode === 'first' && wheel > 0) this.setViewMode('third');
    }

    // ---- crouch --------------------------------------------------------
    const wantCrouch = input.isDown('crouch') && !this.frozen;
    if (wantCrouch && !this.crouching) {
      this.crouching = true;
      body.height = body.crouchHeight;
    } else if (!wantCrouch && this.crouching && body.canStand()) {
      this.crouching = false;
      body.height = body.standHeight;
    }

    // ---- move ----------------------------------------------------------
    this.forward(_forward);
    _right.set(-_forward.z, 0, _forward.x);
    _wish.set(0, 0, 0);
    if (!this.frozen) {
      if (input.isDown('forward')) _wish.add(_forward);
      if (input.isDown('back')) _wish.sub(_forward);
      if (input.isDown('right')) _wish.add(_right);
      if (input.isDown('left')) _wish.sub(_right);
    }
    const hasInput = _wish.lengthSq() > 0;
    if (hasInput) _wish.normalize();

    const sprinting = hasInput && input.isDown('sprint') && !this.crouching && this.stamina > 1 && !this.exhausted;
    if (sprinting) this.stamina = Math.max(0, this.stamina - 30 * dt);
    else this.stamina = Math.min(100, this.stamina + (body.grounded ? 22 : 10) * dt);
    if (this.stamina <= 1) this.exhausted = true;
    if (this.exhausted && this.stamina > 30) this.exhausted = false;

    const speed = this.crouching ? 2.1 : sprinting ? 7.0 : 4.3;
    this.launchTimer = Math.max(0, this.launchTimer - dt);
    const accel = body.grounded ? 16 : this.launchTimer > 0 ? 0.6 : 5;
    const k = 1 - Math.exp(-accel * dt);
    body.velocity.x += (_wish.x * speed - body.velocity.x) * k;
    body.velocity.z += (_wish.z * speed - body.velocity.z) * k;

    // ---- jump (with coyote time + input buffering for forgiving timing) --
    this.coyote = body.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    if (input.wasPressed('jump') && !this.frozen) this.jumpBuffer = 0.14;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (body.grounded) this.usedDoubleJump = false;

    this.thrust = Math.max(0, this.thrust - dt * 3);
    if (this.jumpBuffer > 0 && !this.crouching) {
      if (this.coyote > 0) {
        body.velocity.y = 8.2;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.thrust = 0.6;
        audio.play('jump', { volume: 0.7 });
      } else if (this.abilities.doubleJump && !this.usedDoubleJump && !body.grounded) {
        body.velocity.y = 8.0;
        this.usedDoubleJump = true;
        this.jumpBuffer = 0;
        this.thrust = 1.2;
        this.addShake(0.15);
        audio.play('boost', { volume: 0.8 });
        this.game.stats.boosts++;
      }
    }

    const before = _pivot.copy(body.position);
    body.step(dt);
    const moved = Math.hypot(body.position.x - before.x, body.position.z - before.z);
    this.distanceTravelled += moved;

    if (body.landingSpeed > 7) {
      audio.play('land', { volume: Math.min(1, body.landingSpeed / 14) });
      this.landDip = Math.min(0.18, body.landingSpeed * 0.012);
      this.addShake(Math.min(0.3, body.landingSpeed * 0.015));
    }

    // Footstep servo clicks.
    if (body.grounded && moved > 0) {
      this.stepDistance += moved;
      const stride = sprinting ? 2.0 : 1.5;
      if (this.stepDistance > stride) {
        this.stepDistance = 0;
        audio.play('step', { volume: this.crouching ? 0.25 : 0.55, pitch: 0.9 + Math.random() * 0.2 });
      }
    }

    // ---- flashlight battery ----------------------------------------------
    if (this.flashlightOn) {
      this.battery = Math.max(0, this.battery - dt * (this.game.level?.batteryDrain ?? 0.6));
      if (this.battery <= 0) {
        this.flashlightOn = false;
        audio.play('error');
        this.game.ui.toast('Flashlight battery depleted');
      }
    } else {
      this.battery = Math.min(100, this.battery + dt * 6);
    }

    // ---- timers ------------------------------------------------------------
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    this.landDip = Math.max(0, this.landDip - dt * 0.6);

    // ---- avatar --------------------------------------------------------------
    const horizSpeed = Math.hypot(body.velocity.x, body.velocity.z);
    this.robot.position.copy(body.position);
    this.robot.rotation.y = this.yaw;
    this.rig.update(dt, {
      speed: horizSpeed,
      distance: moved,
      pitch: this.pitch,
      grounded: body.grounded,
      crouch: this.crouching,
      thrust: this.thrust,
      hurt: this.hurtTimer,
      lowPower: this.integrity < 35
    });

    this.updateCamera(dt, horizSpeed, sprinting);
    this.updateFlashlight(dt);
  }

  updateCamera(dt, horizSpeed = 0, sprinting = false) {
    const cam = this.camera;
    const motion = settings.get('motionFx');

    // Head bob.
    if (this.body.grounded && horizSpeed > 0.5 && motion) this.bobPhase += dt * horizSpeed * 2.2;
    const bobAmount = motion ? Math.min(1, horizSpeed / 6) : 0;
    const bobY = Math.sin(this.bobPhase * 2) * 0.035 * bobAmount;
    const bobX = Math.cos(this.bobPhase) * 0.025 * bobAmount;

    // Trauma-based shake (squared for a nice falloff).
    const shake = this.trauma * this.trauma;
    const t = performance.now() * 0.001;
    const sx = (Math.sin(t * 37.1) + Math.sin(t * 23.7)) * 0.5 * shake;
    const sy = (Math.sin(t * 41.3) + Math.sin(t * 19.9)) * 0.5 * shake;

    this.headPosition(_pivot);
    _pivot.y -= this.landDip;

    if (this.viewMode === 'first') {
      cam.position.copy(_pivot);
      cam.position.y += bobY;
      _euler.set(this.pitch + sy * 0.06, this.yaw + sx * 0.06, sx * 0.03 + bobX * 0.3);
      cam.quaternion.setFromEuler(_euler);
      // View arms sway with movement.
      const arms = this.viewArms.userData.arms;
      const reach = this.rig.reach;
      arms[0].position.y = -0.36 + bobY * 0.8;
      arms[1].position.y = -0.36 - bobY * 0.8;
      arms[1].position.z = -0.42 - reach * 0.12;
      arms[0].rotation.x = this.body.grounded ? 0 : -0.25;
      arms[1].rotation.x = (this.body.grounded ? 0 : -0.25) + reach * 0.3;
    } else {
      // Orbit behind and slightly over the shoulder; pull in when a wall is in the way.
      this.lookDirection(_camDir);
      _pivot.y += 0.25;
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      _pivot.addScaledVector(_right, 0.35);
      const back = _desired.copy(_camDir).negate();
      const hit = this.game.physics.raycast(_pivot, back, this.tpDistance + 0.3, (c) => c.tag !== 'trigger' && c.blocksSight);
      const allowed = Math.max(0.6, Math.min(this.tpDistance, hit - 0.3));
      // Pull in instantly (no clipping), ease back out smoothly.
      this.tpCurrent = allowed < this.tpCurrent ? allowed : THREE.MathUtils.lerp(this.tpCurrent, allowed, 1 - Math.exp(-dt * 4));
      cam.position.copy(_pivot).addScaledVector(back, this.tpCurrent);
      cam.position.x += sx * 0.15;
      cam.position.y += sy * 0.15;
      _lookTarget.copy(_pivot).addScaledVector(_camDir, 4);
      cam.lookAt(_lookTarget);
    }

    // Sprint FOV kick.
    const baseFov = settings.get('fov');
    const targetFov = baseFov + (sprinting && motion ? 8 : 0);
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-(dt || 1) * 6));
      cam.updateProjectionMatrix();
    }
  }

  updateFlashlight(dt) {
    // The beam originates at the robot's head and points where the player looks.
    this.headPosition(this.flashRig.position);
    _euler.set(this.pitch, this.yaw, 0);
    this.flashRig.quaternion.setFromEuler(_euler);
    const target = this.flashlightOn ? 110 * (this.battery < 15 ? 0.4 + Math.random() * 0.6 : 1) : 0;
    // Intensity only — toggling .visible would change the light count and force
    // every material to recompile (a visible stutter).
    this.flashlight.intensity = THREE.MathUtils.lerp(this.flashlight.intensity, target, 1 - Math.exp(-dt * 20));
  }

  dispose() {
    this.game.scene.remove(this.robot, this.flashRig);
    this.camera.remove(this.viewArms);
  }
}
