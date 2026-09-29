import "./style.css";
import * as THREE from "three";

import { PlayerControls } from "./player/controls.js";
import { InteractionSystem } from "./player/interaction-system.js";
import { createRobot } from "./player/robot.js";

import { buildLevel } from "./world/level.js";
import { createFlashlight } from "./lights/flashlight.js";
import { createLevelState } from "./game/level-state.js";
import { ObjectiveTracker } from "./game/objectives.js";
import { LevelTimer } from "./game/level2-timer.js";
import { HUD } from "./ui/hud.js";

// --- renderer / scene / camera ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
scene.add(new THREE.AmbientLight(0xffffff, 1));

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0.4, -2);
camera.lookAt(0, 0.4, -4);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.querySelector("#app").appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- game systems ---
const objectiveTracker = new ObjectiveTracker(3);
const hud = new HUD(objectiveTracker);
hud.setLevelTimer(new LevelTimer(60));
const interactionSystem = new InteractionSystem(
  camera,
  scene,
  objectiveTracker,
  hud,
);

const level = await buildLevel({ scene, interactionSystem });

const controls = new PlayerControls(camera, renderer.domElement);
controls.setObstacles(level.collisionObjects);
controls.setWalkable(level.isInside);

createFlashlight(camera);
const robot = await createRobot(scene, camera, controls);
const levelState = createLevelState({
  scene,
  camera,
  hud,
  interactionSystem,
  objectiveTracker,
  level,
});

// --- loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  controls.update(delta);
  robot.update(delta);
  interactionSystem.update(delta);
  level.update(delta);
  levelState.update(delta);

  renderer.render(scene, camera);
}
animate();
