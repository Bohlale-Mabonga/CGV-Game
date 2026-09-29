import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * state: "closed"   -> frozen at frame 0, blocks the player
 *        "open"     -> frozen at last frame, passable
 *        "animated" -> frozen at frame 0 until open() is called
 */
export function createDoor(scene, gltf, { pos, rot = 0, state }) {
  const object = SkeletonUtils.clone(gltf.scene);
  object.position.set(pos[0], 0, pos[1]);
  object.rotation.y = rot;
  object.userData = { ignoreCollision: state === "open" };
  scene.add(object);

  const clip = gltf.animations[0];
  const mixer = new THREE.AnimationMixer(object);
  const action = mixer.clipAction(clip);
  action.clampWhenFinished = true;
  action.setLoop(THREE.LoopOnce, 1);
  action.play();

  if (state === "open") mixer.setTime(clip.duration);
  else mixer.setTime(0);
  action.paused = true;

  return {
    object,
    mixer,
    action,
    open() {
      if (object.userData.isOpen) return;
      object.userData.isOpen = true;
      object.userData.ignoreCollision = true;
      action.paused = false;
    },
  };
}

const HALF_PI = Math.PI / 2;

const DOOR_DEFS = {
  start: { pos: [0, 0], rot: 0, state: "closed" },
  office: [
    { pos: [-2, -6], rot: HALF_PI, state: "open" },
    { pos: [2, -6], rot: -HALF_PI, state: "open" },
    { pos: [-2, -16], rot: HALF_PI, state: "open" },
    { pos: [2, -16], rot: -HALF_PI, state: "open" },
  ],

  end: { pos: [0, -20], rot: 0, state: "animated" },
};

export function buildDoors(scene, gltf) {
  const start = createDoor(scene, gltf, DOOR_DEFS.start);
  const office = DOOR_DEFS.office.map((d) => createDoor(scene, gltf, d));
  const end = createDoor(scene, gltf, DOOR_DEFS.end);
  return { start, office, end, all: [start, ...office, end] };
}
