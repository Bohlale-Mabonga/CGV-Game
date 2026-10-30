// Short scripted cutscenes for SPARK: stowing a keycard in its chest pouch and
// swiping the cards at the exit card reader.
//
// An action plays where it happens: the gameplay camera blends into a shot
// around SPARK (Player.shot) so the real room stays in the background, SPARK
// is posed through RobotRig.fx, and the level keeps running underneath. Every
// motion is a pure function of the action clock and every side effect is an
// event on that clock, so skipping simply jumps to the end and fires whatever
// has not fired yet.

import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { CARD_HOLD_SCALE, CARD_HOLD_TIP } from './robot.js';

const lerp = THREE.MathUtils.lerp;

// Eases 0 → 1 as t runs from a to b.
function seg(t, a, b) {
  const k = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
}

// Eases an angle towards a target along the short way round.
function turnToward(current, target, dt, rate) {
  const d = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + d * (1 - Math.exp(-dt * rate));
}

// Yaw that makes a robot at `from` face `to` (forward is -Z at yaw 0).
function yawToward(from, to) {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

// Robot-local offset (x right, y up, z back) → world offset for a given yaw.
function localOffset(out, yaw, x, y, z) {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return out.set(x * c + z * s, y, -x * s + z * c);
}

const blocksView = (c) => c.tag !== 'trigger' && c.blocksSight;
const _off = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

// Picks a camera position around `focus` from the candidate offsets (robot
// space, tried in order): the first with a clear line of sight wins, otherwise
// the roomiest one is pulled in until it stops clipping the wall. `unwanted`
// (offset → boolean) marks spots to try last, such as ones that put a bright
// beam or SPARK's own path between the camera and the action.
function pickCameraSpot(physics, focus, yaw, candidates, out, unwanted = null) {
  const margin = 0.3;
  let best = null;
  let bestRoom = -1;
  for (const strict of unwanted ? [true, false] : [false]) {
    for (const [x, y, z] of candidates) {
      localOffset(_off, yaw, x, y, z);
      const dist = _off.length();
      _dir.copy(_off).divideScalar(dist);
      if (strict && unwanted(_off)) continue;
      const hit = physics.raycast(focus, _dir, dist + margin, blocksView);
      if (hit >= dist + margin - 1e-4) return out.copy(focus).add(_off);
      const room = hit - margin;
      if (room > bestRoom) {
        bestRoom = room;
        best = _a.copy(_dir).multiplyScalar(Math.max(0.5, room));
      }
    }
    if (best) break;
  }
  return out.copy(focus).add(best);
}

// Distance on the floor plane from point p to the segment a → b.
function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const k = len2 > 1e-6 ? THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * k), pz - (az + dz * k));
}

class RobotAction {
  constructor(game, duration) {
    this.game = game;
    this.player = game.player;
    this.rig = game.player.rig;
    this.duration = duration;
    this.time = 0;
    this.done = false;
    this.skipped = false;
    this.events = [];
    this.shot = { position: new THREE.Vector3(), target: new THREE.Vector3(), weight: 0, fov: 52 };
    this.shotFrom = new THREE.Vector3();
    this.shotTo = new THREE.Vector3();
  }

  at(time, fn) {
    this.events.push({ time, fn, fired: false });
  }

  start() {
    this.player.shot = this.shot;
  }

  skip() {
    this.skipped = true;
  }

  // Advances the clock, poses SPARK and fires every event that is now due.
  tick(dt) {
    this.time = this.skipped ? this.duration : Math.min(this.duration, this.time + dt);
    this.pose(this.time, dt);
    for (const event of this.events) {
      if (!event.fired && event.time <= this.time) {
        event.fired = true;
        event.fn();
      }
    }
    if (this.time >= this.duration) this.done = true;
  }

  pose() {}

  // The camera drifts slowly from shotFrom to shotTo and fades in and out over
  // the gameplay camera; the scripted layer of the rig fades with it.
  updateShot(t, look) {
    const k = seg(t, 0, this.duration);
    this.shot.position.lerpVectors(this.shotFrom, this.shotTo, k);
    this.shot.target.copy(look);
    this.rig.fx.viewPoint.copy(this.shot.position);
    this.shot.weight = seg(t, 0, 0.4) * (1 - seg(t, this.duration - 0.45, this.duration));
    this.rig.fx.weight = seg(t, 0.15, 0.5) * (1 - seg(t, this.duration - 0.5, this.duration - 0.1));
  }

  finish() {
    const fx = this.rig.fx;
    this.player.shot = null;
    this.player.drive = null;
    Object.assign(fx, { weight: 0, armWeight: 0, grip: 0, lean: 0, twist: 0, headX: 0, headY: 0, reachTip: 0.04, hover: 0 });
    this.rig.holdCard(null);
    this.rig.setPouchGlow(0);
  }
}

// ---------------------------------------------------------------------------
// Picking up a keycard: SPARK turns to the floating card, raises a claw, the
// card is pulled free of its projector into the claw, and SPARK tucks it into
// the pouch on its chest.
// ---------------------------------------------------------------------------
const PICKUP = { reach: 0.3, pull: 0.55, grab: 1.0, carry: 1.1, stow: 1.7, lower: 1.8, end: 2.6 };

export class CardPickupAction extends RobotAction {
  constructor(game, keycard) {
    super(game, PICKUP.end);
    this.keycard = keycard;
    this.color = keycard.color.getHex();
    this.cardStart = new THREE.Vector3();
    this.reachTarget = new THREE.Vector3();
    this.look = new THREE.Vector3();
  }

  start() {
    super.start();
    const { player, keycard } = this;
    keycard.card.getWorldPosition(this.cardStart);
    const eye = player.headPosition(_a);
    this.faceYaw = yawToward(player.position, this.cardStart);
    const flat = Math.hypot(this.cardStart.x - eye.x, this.cardStart.z - eye.z);
    this.lookPitch = THREE.MathUtils.clamp(Math.atan2(this.cardStart.y - eye.y, flat), -0.3, 0.6);

    // Camera: a front three-quarter view of SPARK that also holds the card, at
    // whichever side has a clear line of sight.
    const chest = _b.set(player.position.x, player.position.y + 0.72, player.position.z);
    pickCameraSpot(this.game.physics, chest, this.faceYaw, [
      [-2.0, 0.25, -0.3], [2.0, 0.25, -0.3], [-1.9, 0.25, 0.9], [1.9, 0.25, 0.9],
      [-1.2, 0.25, -2.0], [1.2, 0.25, -2.0], [0, 0.35, 2.4]
    ], this.shotFrom, (offset) => {
      // A beam right beside SPARK cannot be avoided by much, so scale the keep-out radius.
      const radius = THREE.MathUtils.clamp(0.6 * Math.hypot(this.cardStart.x - chest.x, this.cardStart.z - chest.z), 0.25, 0.7);
      return distanceToSegment(this.cardStart.x, this.cardStart.z, chest.x, chest.z, chest.x + offset.x, chest.z + offset.z) < radius;
    });
    this.shotTo.copy(this.shotFrom).lerp(chest, 0.1);
    this.look.set(chest.x, player.position.y + 0.62, chest.z).lerp(this.cardStart, 0.1);
    // How far round SPARK's chest must turn to face the camera while it stows the card.
    const toCamera = yawToward(player.position, this.shotFrom) - this.faceYaw;
    this.twist = THREE.MathUtils.clamp(Math.atan2(Math.sin(toCamera), Math.cos(toCamera)) * 0.8, -1.0, 1.0);
    this.setupEvents();
  }

  setupEvents() {
    const { rig, keycard } = this;
    this.at(PICKUP.reach, () => audio.play('servo', { volume: 0.6 }));
    this.at(PICKUP.pull, () => {
      keycard.pulled = true;
      audio.play('pickup', { volume: 0.5 });
    });
    this.at(PICKUP.grab, () => {
      keycard.card.visible = false;
      rig.holdCard(this.color);
      audio.play('keycard');
    });
    this.at(PICKUP.stow, () => {
      rig.holdCard(null);
      rig.stowCard(this.color);
      audio.play('ui', { pitch: 0.7 });
      keycard.onCollect?.(keycard);
    });
  }

  pose(t, dt) {
    const { player, rig, keycard } = this;
    const fx = rig.fx;
    const rate = 1 - Math.exp(-dt * 6);
    player.yaw = turnToward(player.yaw, this.faceYaw, dt, 9);
    player.pitch = lerp(player.pitch, t < PICKUP.lower ? this.lookPitch : 0.05, rate);
    this.updateShot(t, this.look);

    // Right arm: out towards the card, across to the pouch, back down.
    const out = seg(t, PICKUP.reach, 0.85);
    const carry = seg(t, PICKUP.carry, 1.6);
    const back = seg(t, PICKUP.lower, 2.2);
    rig.n.shoulderR.getWorldPosition(_a);
    _dir.subVectors(this.cardStart, _a);
    const toCard = _dir.length();
    this.reachTarget.copy(_a).addScaledVector(_dir.normalize(), Math.min(0.44, toCard));
    rig.pouchWorld(_b);
    _b.y += 0.07 * (1 - seg(t, 1.45, 1.7)); // hover over the slit, then drop in
    fx.armSpace = 'world';
    fx.armTarget.lerpVectors(this.reachTarget, _b, carry);
    fx.armTarget.y += Math.sin(carry * Math.PI) * 0.06;
    fx.armPole.set(0.8, -0.5, 0.4);
    fx.armWeight = out * (1 - back);
    fx.grip = seg(t, 0.95, 1.12) * (1 - seg(t, PICKUP.stow, 1.85));
    fx.reachTip = lerp(0.04, CARD_HOLD_TIP, seg(t, 0.98, 1.15) * (1 - seg(t, PICKUP.stow, 1.85)));
    fx.lean = -0.14 * out * (1 - back);
    fx.twist = this.twist * lerp(0.25 * out, 1, carry) * (1 - back);
    fx.headX = lerp(0.1 * out, -0.5, carry) * (1 - back);
    rig.setPouchGlow(Math.sin(seg(t, 1.5, 1.95) * Math.PI));

    // The card leaves its projector and flies to the claw.
    if (t >= PICKUP.pull && t < PICKUP.grab) {
      const k = seg(t, PICKUP.pull, PICKUP.grab);
      rig.heldCard.getWorldPosition(_c);
      _a.lerpVectors(this.cardStart, _c, k);
      _a.y += Math.sin(k * Math.PI) * 0.14;
      keycard.placeCard(_a, lerp(1, CARD_HOLD_SCALE, k));
    }
  }

  finish() {
    super.finish();
    this.keycard.finishPull();
  }
}

// ---------------------------------------------------------------------------
// Swiping keycards at a card reader: SPARK rolls up to the reader, takes each
// card out of its pouch in turn and swipes it along that card's slot, then
// turns to watch the door open.
// ---------------------------------------------------------------------------
const UPLOAD = { start: 0.95, cycle: 1.15, tail: 1.4 };
const REST_HAND = new THREE.Vector3(0.33, -0.24, -0.04); // torso space: claw hanging by SPARK's side

export class CardUploadAction extends RobotAction {
  // cards: [{ slot: Vector3, color }] in slot order (slot = centre of the slot face, world).
  // reader: { out, along } unit vectors: away from the reader face, and along the slots.
  constructor(game, { cards, stand, yaw, reader, lookAtAfter, onInsert, onDone }) {
    super(game, UPLOAD.start + cards.length * UPLOAD.cycle + UPLOAD.tail);
    this.cards = cards;
    this.stand = stand;
    this.yaw = yaw;
    this.out = reader.out;
    this.along = reader.along;
    this.lookAtAfter = lookAtAfter;
    this.onInsert = onInsert;
    this.onDone = onDone;
    this.look = new THREE.Vector3();
    this.lookCards = new THREE.Vector3();
    this.rest = new THREE.Vector3();
    this.from = new THREE.Vector3();
    this.points = [0, 1, 2, 3, 4].map(() => new THREE.Vector3());
  }

  start() {
    super.start();
    const { cards, stand, player, rig } = this;
    const last = cards.length - 1;
    this.afterYaw = yawToward(stand, this.lookAtAfter);

    // Camera: in front of SPARK's chest (so the pouch shows) with the reader
    // beside it, from whichever side is clear.
    const chest = _b.set(stand.x, stand.y + 0.85, stand.z);
    const middle = cards[Math.floor(last / 2)].slot;
    this.lookCards.copy(chest).lerp(middle, 0.75);
    pickCameraSpot(this.game.physics, chest, this.yaw, [
      [-0.6, 0.5, -2.5], [0.4, 0.5, -2.5], [-1.5, 0.5, -1.7], [1.5, 0.5, -1.7], [-1.2, 0.5, 1.6]
    ], this.shotFrom, (offset) => {
      // Keep clear of the line SPARK rolls along to get to the reader.
      const spot = _c.copy(chest).add(offset);
      return distanceToSegment(spot.x, spot.z, player.position.x, player.position.z, stand.x, stand.z) < 1.3;
    });
    this.shotTo.copy(this.shotFrom).lerp(chest, 0.1);

    // Slide off the reader's slots one at a time.
    cards.forEach((card, i) => {
      const s = UPLOAD.start + i * UPLOAD.cycle;
      this.at(s + 0.05, () => audio.play('servo', { volume: 0.5 }));
      this.at(s + 0.26, () => {
        rig.takeCard(card.color);
        rig.holdCard(card.color);
        audio.play('ui', { pitch: 0.8 });
      });
      this.at(s + 0.93, () => {
        rig.holdCard(null);
        this.onInsert(i);
      });
    });
    this.at(UPLOAD.start + last * UPLOAD.cycle + 1.1, () => this.onDone());
    this.endTurn = this.duration - UPLOAD.tail + 0.2;
    player.drive = null;
  }

  pose(t, dt) {
    const { player, rig, cards } = this;
    const fx = rig.fx;
    const end = this.duration;

    // Roll to the reader, then look at the door once the last card is in.
    const away = _a.set(this.stand.x - player.position.x, 0, this.stand.z - player.position.z);
    const dist = away.length();
    player.drive = t < 1.6 && dist > 0.05 ? { x: away.x / dist, z: away.z / dist, speed: Math.min(3.2, 0.5 + dist * 4) } : null;
    player.yaw = turnToward(player.yaw, t < this.endTurn ? this.yaw : this.afterYaw, dt, 7);
    player.pitch = lerp(player.pitch, 0.05, 1 - Math.exp(-dt * 6));
    this.updateShot(t, this.look.lerpVectors(this.lookCards, this.lookAtAfter, seg(t, end - 1.4, end - 0.4)));

    // Which card is being handled, and how far through its cycle.
    const index = THREE.MathUtils.clamp(Math.floor((t - UPLOAD.start) / UPLOAD.cycle), 0, cards.length - 1);
    const u = t - (UPLOAD.start + index * UPLOAD.cycle);
    const { slot } = cards[index];
    const [pouch, approach, engage, swipeEnd, withdraw] = this.points;
    rig.pouchWorld(pouch).y += 0.06;
    approach.copy(slot).addScaledVector(this.out, 0.07).addScaledVector(this.along, -0.2);
    engage.copy(slot).addScaledVector(this.along, -0.2);
    swipeEnd.copy(slot).addScaledVector(this.along, 0.2);
    withdraw.copy(swipeEnd).addScaledVector(this.out, 0.12);

    // Where the claw starts this card's journey: hanging at SPARK's side for
    // the first card, otherwise wherever the last swipe ended.
    if (index === 0) this.from.copy(rig.n.torso.localToWorld(this.rest.copy(REST_HAND)));
    else {
      const previous = cards[index - 1].slot;
      this.from.copy(previous).addScaledVector(this.along, 0.2).addScaledVector(this.out, 0.12);
    }
    const hand = fx.armTarget.copy(this.from);
    hand.lerp(pouch, seg(u, 0, 0.26));
    hand.lerp(approach, seg(u, 0.3, 0.64));
    hand.lerp(engage, seg(u, 0.64, 0.72));
    hand.lerp(swipeEnd, seg(u, 0.72, 0.92));
    hand.lerp(withdraw, seg(u, 0.92, 1.08));
    hand.y += Math.sin(seg(u, 0.3, 0.64) * Math.PI) * 0.05;

    const holding = seg(u, 0.22, 0.3) * (1 - seg(u, 0.93, 1.0));
    const active = seg(t, 0.5, UPLOAD.start) * (1 - seg(t, end - 1.3, end - 0.6));
    fx.armSpace = 'world';
    fx.armPole.set(0.4, -0.8, 0.5);
    fx.armWeight = active;
    fx.grip = holding;
    fx.reachTip = lerp(0.04, CARD_HOLD_TIP, seg(u, 0.24, 0.32) * (1 - seg(u, 0.93, 1.0)));
    fx.twist = -0.3 * active;
    fx.lean = -0.08 * active;
    fx.headX = lerp(-0.4, 0.05, seg(u, 0.28, 0.5)) * active;
    fx.headY = -0.55 * seg(u, 0.35, 0.6) * (1 - seg(u, 1.0, 1.15)) * active;
    rig.setPouchGlow(Math.sin(seg(u, 0.1, 0.45) * Math.PI) * active);
  }
}
