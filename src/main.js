import "./style.css";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AnimationMixer } from "three";

import { PlayerControls } from "./player/controls.js";
import { InteractionSystem } from "./player/interaction-system.js";

import { createCorridorSegment } from "./world/corridor.js";
import { createKeycard, createDoor } from "./world/interactables.js";

import { ObjectiveTracker } from "./game/objectives.js";
import { createFlashlight } from "./lights/flashlight.js";
import { HUD } from "./ui/hud.js";
import { createSteamVent, checkSteamVentHit } from "./world/steam-vent.js";
import {
  createPowerJunction,
  createReactorConsole,
  updatePowerPuzzle,
  resetPowerPuzzle,
} from "./world/power-puzzle.js";

import { createControlRoom } from "./world/control-room.js";
import {
  createSecurityBeam,
  checkSecurityBeamHit,
} from "./world/security-beam.js";

import { LevelTimer } from "./game/level2-timer.js";

import { createReactorCore, checkCoreReached } from "./world/reactor-core.js";

import {
  createCollapseSequence,
  updateCollapseSequence,
  checkCollapseHit,
  resetCollapseSequence,
} from "./world/collapse-sequence.js";

import { createLevel1Props } from "./world/level1-props.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);

camera.position.set(0, 0.6, -2);
camera.lookAt(0, 1.5, -4);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const app = document.querySelector("#app");
app.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1));

// const debugLight = new THREE.DirectionalLight(0xffffff, 2);
// debugLight.position.set(3, 6, 4);
// scene.add(debugLight);

function load(url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => resolve(gltf),
      undefined,
      (error) => reject(error),
    );
  });
}

let rooms = []; // store all walkable rooms

async function buildLevel() {
  const [straight, xCorridor, office, doorGltf] = await Promise.all([
    load("assets/straight-corridor.glb"),
    load("assets/x-corridor.glb"),
    load("assets/office.glb"),
    load("assets/sliding_door.glb"),
  ]);

  const door = doorGltf.scene;
  const doorClips = doorGltf.animations;

  function createDoorInstance(position, rotationY, state) {
    const instance = SkeletonUtils.clone(door);
    instance.position.copy(position);
    if (rotationY) instance.rotation.y = rotationY;
    instance.userData = { ignoreCollision: state === "open" };
    scene.add(instance);

    const mixer = new THREE.AnimationMixer(instance);
    const clip = doorClips[0];
    const action = mixer.clipAction(clip);
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 1);

    action.play(); // activate the action in the mixer first

    if (state === "closed") {
      mixer.setTime(0); // set time WHILE unpaused
      action.paused = true; // then freeze
    } else if (state === "open") {
      mixer.setTime(clip.duration);
      action.paused = true;
    } else if (state === "animated") {
      action.paused = true; // frozen at frame 0, waiting for trigger
    }

    return { object: instance, mixer, action };
  }

  // straight: 2m wide, 6m long
  const s1 = SkeletonUtils.clone(straight.scene);
  s1.position.set(0, 0, 0);
  s1.userData = { halfW: 2 / 2, halfD: 6 / 2 };
  scene.add(s1);

  const x1 = SkeletonUtils.clone(xCorridor.scene);
  x1.position.set(0, 0, -6);
  x1.userData = { shape: "cross", halfW: 6 / 2, halfD: 10 / 2, armHalf: 1 }; // armHalf = half-thickness of each arm (2m wide / 2)
  scene.add(x1);

  const x2 = SkeletonUtils.clone(xCorridor.scene);
  x2.position.set(0, 0, -16);
  x2.userData = { shape: "cross", halfW: 6 / 2, halfD: 10 / 2, armHalf: 1 };
  scene.add(x2);

  // offices: 4m wide (X) and 6m deep
  const o1 = SkeletonUtils.clone(office.scene);
  o1.position.set(-5, 0, -6);
  o1.userData = { halfW: 4 / 2, halfD: 4 / 2 };
  scene.add(o1);

  const o2 = SkeletonUtils.clone(office.scene);
  o2.position.set(5, 0, -6);
  o2.rotation.y = Math.PI;
  o2.userData = { halfW: 4 / 2, halfD: 4 / 2 };
  scene.add(o2);

  const o3 = SkeletonUtils.clone(office.scene);
  o3.position.set(-5, 0, -16);
  o3.userData = { halfW: 4 / 2, halfD: 4 / 2 };
  scene.add(o3);

  const o4 = SkeletonUtils.clone(office.scene);
  o4.position.set(5, 0, -16);
  o4.rotation.y = Math.PI;
  o4.userData = { halfW: 4 / 2, halfD: 4 / 2 };
  scene.add(o4);

  const startDoor = createDoorInstance(new THREE.Vector3(0, 0, 0), 0, "closed");

  const officeDoors = [
    createDoorInstance(new THREE.Vector3(-2, 0, -6), Math.PI / 2, "open"),
    createDoorInstance(new THREE.Vector3(2, 0, -6), -Math.PI / 2, "open"),
    createDoorInstance(new THREE.Vector3(-2, 0, -16), Math.PI / 2, "open"),
    createDoorInstance(new THREE.Vector3(2, 0, -16), -Math.PI / 2, "open"),
  ];

  const endDoor = createDoorInstance(
    new THREE.Vector3(0, 0, -20),
    0,
    "animated",
  );

  window.endDoor = endDoor;

  collisionObjects.push(startDoor.object);
  collisionObjects.push(...officeDoors.map((d) => d.object));
  collisionObjects.push(endDoor.object);

  rooms = [s1, x1, x2, o1, o2, o3, o4];

  window.isInsideAnyRoom = (px, pz) => {
    return rooms.some((r) => {
      const dx = px - r.position.x;
      const dz = pz - r.position.z;

      if (r.userData.shape === "cross") {
        const arm = r.userData.armHalf;
        return (
          (Math.abs(dx) < arm && Math.abs(dz) < r.userData.halfD) ||
          (Math.abs(dz) < arm && Math.abs(dx) < r.userData.halfW)
        );
      }

      // default: plain rectangle (straight corridor, offices)
      return Math.abs(dx) < r.userData.halfW && Math.abs(dz) < r.userData.halfD;
    });
  };
}

buildLevel();

const collisionObjects = [];
// const level1Props = createLevel1Props();

// for (const prop of level1Props.props) {
//   scene.add(prop);
//   if (prop.userData.type === 'crate') {
//     collisionObjects.push(prop);
//   }
// }
createFlashlight(camera);

const playercontrols = new PlayerControls(camera, renderer.domElement);

const originalUpdate = playercontrols.update.bind(playercontrols);
playercontrols.update = (delta) => {
  const oldPos = camera.position.clone();
  originalUpdate(delta);
  if (
    window.isInsideAnyRoom &&
    !window.isInsideAnyRoom(camera.position.x, camera.position.z)
  ) {
    camera.position.copy(oldPos); // hit wall, revert
  }
};

playercontrols.setObstacles(collisionObjects);

const objectiveTracker = new ObjectiveTracker(3);
const hud = new HUD(objectiveTracker);
const level2Timer = new LevelTimer(60);
hud.setLevelTimer(level2Timer);

const interactionSystem = new InteractionSystem(
  camera,
  scene,
  objectiveTracker,
  hud,
);

interactionSystem.register(createKeycard(new THREE.Vector3(-5.5, 0.5, -7.5)));
interactionSystem.register(createKeycard(new THREE.Vector3(0.5, 0.5, -13.5)));
interactionSystem.register(createKeycard(new THREE.Vector3(5.5, 0.5, -14.5)));

// interactionSystem.register(level1Door);
// collisionObjects.push(level1Door);
// const checkpointPosition = new THREE.Vector3(0, 1.6, 6);

// const steamVents = [
//   createSteamVent(new THREE.Vector3(0, 0, -6.5))
// ];

// for (const vent of steamVents) {
//   scene.add(vent);
// }
// const powerJunctions = [
//   createPowerJunction(new THREE.Vector3(-2, 1.4, -26), 1),
//   createPowerJunction(new THREE.Vector3(0, 1.4, -26), 2),
//   createPowerJunction(new THREE.Vector3(2, 1.4, -26), 3)
// ];

// const reactorConsole = createReactorConsole(
//   new THREE.Vector3(0, 0.8, -23)
// );
// const controlRoom = createControlRoom(new THREE.Vector3(0, 0, -22));
// scene.add(controlRoom);

// for (const junction of powerJunctions) {
//   interactionSystem.register(junction);
// }

// const level2CheckpointPosition = new THREE.Vector3(0, 1.6, -19);

// const securityBeams = [
//   createSecurityBeam(new THREE.Vector3(0, 0, -23))
// ];

// for (const beam of securityBeams) {
//   scene.add(beam);
// }

// const meltdownCorridor = createCorridorSegment(18, 4, 3);
// meltdownCorridor.position.z = -34;
// scene.add(meltdownCorridor);

// const reactorCore = createReactorCore(new THREE.Vector3(0, 1.5, -42));
// scene.add(reactorCore);

// const level3Timer = new LevelTimer(45);
// let gameOver = false;

// scene.add(reactorConsole);

// const level3CheckpointPosition = new THREE.Vector3(0, 1.6, -30);
// const collapseChunks = createCollapseSequence();

// for (const chunk of collapseChunks) {
//   scene.add(chunk);
// }

// let collapseStarted = false;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  playercontrols.update(delta);
  interactionSystem.update(delta);

  // for (const vent of steamVents) {
  //   vent.userData.update(delta);
  // }

  // const wasHitBySteam = checkSteamVentHit(
  //   camera,
  //   steamVents,
  //   checkpointPosition
  // );

  // if (wasHitBySteam) {
  //   hud.setMessage('Steam vent hit you - returned to checkpoint');
  // }

  // updatePowerPuzzle(powerJunctions, reactorConsole);

  // for (const beam of securityBeams) {
  //   beam.userData.update(delta);
  // }

  // const wasHitByBeam = checkSecurityBeamHit(
  //   camera,
  //   securityBeams,
  //   level2CheckpointPosition
  // );

  // if (wasHitByBeam) {
  //   hud.setMessage('Security beam hit you - returned to control room entrance');
  // }

  // level2Timer.update(delta);

  // const isPuzzleComplete = updatePowerPuzzle(powerJunctions, reactorConsole);

  // if (isPuzzleComplete) {
  //   level2Timer.stop();
  // }

  // if (level2Timer.isFinished() && !reactorConsole.userData.isComplete) {
  //   camera.position.copy(level2CheckpointPosition);
  //   resetPowerPuzzle(powerJunctions, reactorConsole);
  //   level2Timer.reset();
  //   hud.setMessage('Timer expired - puzzle reset');
  // }

  // hud.update();

  // if (!gameOver) {
  //   reactorCore.userData.update(delta);

  //   const playerInLevel3 = camera.position.z < -30;

  //   if (playerInLevel3) {
  //     collapseStarted = true;
  //   }

  //   if (playerInLevel3 && !reactorCore.userData.isSealed) {
  //     level3Timer.update(delta);

  //     hud.setMessage(`Meltdown Timer: ${level3Timer.getDisplayTime()}s`);

  //     updateCollapseSequence(collapseChunks, delta, collapseStarted);

  //     const wasHitByCollapse = checkCollapseHit(
  //       camera,
  //       collapseChunks,
  //       level3CheckpointPosition
  //     );

  //     if (wasHitByCollapse) {
  //       collapseStarted = false;
  //       resetCollapseSequence(collapseChunks);
  //       level3Timer.reset();
  //       hud.setMessage('Corridor collapsed - returned to Level 3 entrance');
  //     }

  //     if (checkCoreReached(camera, reactorCore)) {
  //       reactorCore.userData.seal();
  //       level3Timer.stop();
  //       gameOver = true;
  //       hud.setMessage('Core sealed - station saved');
  //     }

  //     if (level3Timer.isFinished()) {
  //       gameOver = true;
  //       hud.setMessage('Meltdown - station lost');
  //       console.log('Meltdown - station lost');
  //     }
  //   }
  // }
  // interactionSystem.update(delta);
  // for (const prop of level1Props.animatedProps) {
  //   prop.userData.update(delta);
  // }

  // Open the exit door once all keycards have been collected
  if (
    window.endDoor &&
    !window.endDoor.object.userData.isOpen &&
    objectiveTracker.isObjectiveComplete()
  ) {
    window.endDoor.object.userData.isOpen = true;
    window.endDoor.object.userData.ignoreCollision = true;
    window.endDoor.action.paused = false;
  }

  if (window.endDoor) {
    window.endDoor.mixer.update(delta);
  }

  renderer.render(scene, camera);
}

animate();
