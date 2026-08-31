import './style.css';
import * as THREE from 'three';

import { PlayerControls } from './player/controls.js';
import { InteractionSystem } from './player/interaction-system.js';

import { createCorridorSegment } from './world/corridor.js';
import { createKeycard, createDoor } from './world/interactables.js';

import { ObjectiveTracker } from './game/objectives.js';
import { createFlashlight } from './lights/flashlight.js';
import { HUD } from './ui/hud.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

camera.position.set(0, 1.6, 6);
camera.lookAt(0, 1.5, -4);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const app = document.querySelector('#app');
app.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1));

const debugLight = new THREE.DirectionalLight(0xffffff, 2);
debugLight.position.set(3, 6, 4);
scene.add(debugLight);

const corridor = createCorridorSegment(22, 4, 3);
corridor.position.z = -6;
scene.add(corridor);

createFlashlight(camera);

const controls = new PlayerControls(camera, renderer.domElement);

const objectiveTracker = new ObjectiveTracker(3);
const hud = new HUD(objectiveTracker);

const interactionSystem = new InteractionSystem(
  camera,
  scene,
  objectiveTracker,
  hud
);

interactionSystem.register(createKeycard(new THREE.Vector3(-1, 1, -4)));
interactionSystem.register(createKeycard(new THREE.Vector3(1, 1, -9)));
interactionSystem.register(createKeycard(new THREE.Vector3(0, 1, -13)));

interactionSystem.register(createDoor(new THREE.Vector3(0, 1.1, -16)));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  controls.update(delta);
  interactionSystem.update();

  renderer.render(scene, camera);
}

animate();