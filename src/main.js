import * as THREE from 'three';
import { PlayerControls } from './player/controls.js';
import { createCorridorSegment } from './world/corridor.js';
import { createFlashlight } from './lights/flashlight.js';
import { createKeycard, createDoor } from './world/interactables.js';
import { InteractionSystem } from './player/interaction-system.js';
import { ObjectiveTracker } from './game/objectives.js';

//Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.6, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));

//Corridor
const corridor = createCorridorSegment(20, 4, 3);
corridor.position.z = -6;
scene.add(corridor);

//Flashlight
createFlashlight(camera);

//Player movement
const controls = new PlayerControls(camera, renderer.domElement);

const objectiveTracker = new ObjectiveTracker(3);
const interactionSystem = new InteractionSystem(camera, scene, objectiveTracker);

interactionSystem.register(createKeycard(new THREE.Vector3(-1, 1, -4)));
interactionSystem.register(createKeycard(new THREE.Vector3(1, 1, -10)));
interactionSystem.register(createKeycard(new THREE.Vector3(0, 1, -14)));
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

