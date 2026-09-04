import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

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

const debugLight = new THREE.DirectionalLight(0xffffff, 2);
debugLight.position.set(3, 6, 4);
scene.add(debugLight);

const loader = new GLTFLoader();

loader.load("assets/straight-corridor.glb", (gltf) => {
  const corridor = gltf.scene;
  corridor.position.z = 0;
  scene.add(corridor);
});

loader.load("assets/x-corridor.glb", (gltf) => {
  const corridor = gltf.scene;
  corridor.position.z = 0;
  scene.add(corridor);
});

loader.load("assets/x-corridor.glb", (gltf) => {
  const corridor = gltf.scene;
  corridor.position.z = -9;
  scene.add(corridor);
});

// Add offices at the end of the x-corridors
loader.load("assets/office.glb", (gltf) => {
  const office = gltf.scene;
  office.position.set(-8, 0, -10);
  scene.add(office);
});

loader.load("assets/office.glb", (gltf) => {
  const office = gltf.scene;
  office.position.set(8, 0, -10);
  // Rotate the office 180 degrees along the y-axis to face the corridor
  office.rotation.y = Math.PI;
  scene.add(office);
});

loader.load("assets/office.glb", (gltf) => {
  const office = gltf.scene;
  office.position.set(-8, 0, -19);
  scene.add(office);
});

loader.load("assets/office.glb", (gltf) => {
  const office = gltf.scene;
  office.position.set(8, 0, -19);
  // Rotate the office 180 degrees along the y-axis to face the corridor
  office.rotation.y = Math.PI;
  scene.add(office);
});

// const corridor = createCorridorSegment(22, 4, 3);
// corridor.position.z = -6;
// scene.add(corridor);

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
playercontrols.setBounds({
  minX: -9.8,
  maxX: 9.8,
  minZ: -42,
  maxZ: -2,
});

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

interactionSystem.register(createKeycard(new THREE.Vector3(-7.5, 0.5, -9.5)));
interactionSystem.register(createKeycard(new THREE.Vector3(0.5, 0.5, -15)));
interactionSystem.register(createKeycard(new THREE.Vector3(7.5, 0.5, -20.5)));

const level1Door = createDoor(new THREE.Vector3(0, 1.1, -24));
interactionSystem.register(level1Door);
collisionObjects.push(level1Door);
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

  renderer.render(scene, camera);
}

animate();
