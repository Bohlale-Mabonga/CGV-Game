import './style.css';
import * as THREE from 'three';

import { PlayerControls } from './player/controls.js';
import { InteractionSystem } from './player/interaction-system.js';
import { GameOverlay } from './ui/game-overlay.js';

import {
  createCorridorSegment,
  createSideRoom,
  createHintBeacon
} from './world/corridor.js';
import { createKeycard, createDoor } from './world/interactables.js';
import { LevelTitle } from './ui/level-title.js';

import { ObjectiveTracker } from './game/objectives.js';
import { createFlashlight } from './lights/flashlight.js';
import { HUD } from './ui/hud.js';
import { createSteamVent, checkSteamVentHit } from './world/steam-vent.js';
import {
  createPowerJunction,
  createReactorConsole,
  updatePowerPuzzle,
  resetPowerPuzzle
} from './world/power-puzzle.js';

import { createControlRoom } from './world/control-room.js';
import {
  createSecurityBeam,
  checkSecurityBeamHit
} from './world/security-beam.js';

import { LevelTimer } from './game/level2-timer.js';

import { createReactorCore, checkCoreReached } from './world/reactor-core.js';

import {
  createCollapseSequence,
  updateCollapseSequence,
  checkCollapseHit,
  resetCollapseSequence
} from './world/collapse-sequence.js';

import {
  createCheckpointBeacon,
  createLevel1Props
} from './world/level1-props.js';
import { Minimap } from './ui/minimap.js';

import { createSign } from './world/signage.js';

function createPlayerRobot() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.8, 0.35),
    new THREE.MeshStandardMaterial({
      color: 0x37c8ff,
      emissive: 0x062b36,
      emissiveIntensity: 0.5
    })
  );
  body.position.y = 0.45;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.3, 0.32),
    new THREE.MeshStandardMaterial({
      color: 0xbfdfff,
      emissive: 0x0a3a4a,
      emissiveIntensity: 0.4
    })
  );
  head.position.y = 1.05;
  group.add(head);

  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.06, 0.03),
    new THREE.MeshBasicMaterial({
      color: 0xffffff
    })
  );
  eye.position.set(0, 1.07, -0.18);
  group.add(eye);

  group.visible = false;

  return group;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
scene.fog = new THREE.FogExp2(0x090d12, 0.035);

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
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const app = document.querySelector('#app');
app.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x9fc9ff, 0.28));

const debugLight = new THREE.DirectionalLight(0xbfdfff, 0.45);
debugLight.position.set(3, 6, 4);
scene.add(debugLight);

const corridor = createCorridorSegment(22, 4, 3, [
  // Positions are local to the corridor, whose centre is at world Z = -6.
  { side: 'left', z: 1, width: 2.5 },
  { side: 'right', z: -4, width: 2.5 }
]);
corridor.position.z = -6;
scene.add(corridor);

const leftRoom = createSideRoom(4, 4, 3);
leftRoom.position.set(-4, 0, -5);
leftRoom.rotation.y = -Math.PI / 2;
scene.add(leftRoom);

const rightRoom = createSideRoom(4, 4, 3);
rightRoom.position.set(4, 0, -10);
rightRoom.rotation.y = Math.PI / 2;
scene.add(rightRoom);

const {
  props: level1Props,
  animatedProps: level1AnimatedProps,
  interactables: level1RoomInteractables
} = createLevel1Props();
scene.add(...level1Props);

const level1HintBeacons = [
  createHintBeacon(new THREE.Vector3(-1.7, 1.2, -5), 0x37c8ff),
  createHintBeacon(new THREE.Vector3(1.7, 1.2, -10), 0xffd43b),
  createHintBeacon(new THREE.Vector3(0, 1.2, -13), 0x37ff8b)
];

const level1Signs = [
  createSign(
    'MAINTENANCE BAY',
    new THREE.Vector3(-1.98, 1.7, -5),
    Math.PI / 2,
    { border: '#37c8ff', widthWorld: 1.6, heightWorld: 0.4 }
  ),
  createSign(
    'STORAGE',
    new THREE.Vector3(1.98, 1.7, -10),
    -Math.PI / 2,
    { border: '#ffd43b', widthWorld: 1.3, heightWorld: 0.4 }
  ),
  createSign(
    'REACTOR ACCESS',
    new THREE.Vector3(0, 2.45, -15.9),
    0,
    { border: '#ff5533', widthWorld: 1.8, heightWorld: 0.4 }
  ),
  createSign(
    'KEYCARDS REQUIRED',
    new THREE.Vector3(0, 0.35, -15.75),
    0,
    {
      border: '#ff3344',
      color: '#ffdddd',
      widthWorld: 1.5,
      heightWorld: 0.32,
      fontSize: 34
    }
  )
];

for (const sign of level1Signs) {
  scene.add(sign);
}

for (const beacon of level1HintBeacons) {
  scene.add(beacon);
}

createFlashlight(camera);

const playerRobot = createPlayerRobot();
scene.add(playerRobot);

const controls = new PlayerControls(
  camera,
  renderer.domElement,
  playerRobot
);
controls.setBounds({
  minX: -6.2,
  maxX: 6.2,
  minZ: -42,
  maxZ: 6
});
const minimap = new Minimap(controls);
const objectiveTracker = new ObjectiveTracker(3);
const hud = new HUD(objectiveTracker);

function setHudPhase(phase) {
  // Supports both the current HUD and an older browser-cached HUD module.
  if (typeof hud.setPhase === 'function') {
    hud.setPhase(phase);
    return;
  }

  hud.currentPhase = phase;
  hud.update();
}

setHudPhase('LEVEL 1: Recover three reactor access keycards');

objectiveTracker.onChange = () => {
  hud.update();

  if (objectiveTracker.isObjectiveComplete()) {
    setHudPhase('LEVEL 1: Return to the reactor access door');
    hud.setMessage('All keycards recovered — reactor access is available.');
  }
};
controls.onViewModeChange = (viewMode) => {
  hud.setMessage(
    viewMode === 'firstPerson'
      ? 'First-person view'
      : 'Third-person view'
  );
};
const level2Timer = new LevelTimer(60);
level2Timer.stop();
hud.setLevelTimer(level2Timer);
controls.onStaminaChange = (value, maxValue, isSprinting) => {
  hud.setStamina(value, maxValue, isSprinting);
};

const interactionSystem = new InteractionSystem(
  camera,
  scene,
  objectiveTracker,
  hud,
  2,
  () => controls.getPlayerPosition()
);

for (const interactable of level1RoomInteractables) {
  interactionSystem.register(interactable);
}

const keycard1 = createKeycard(new THREE.Vector3(-5.5, 1, -5));
const keycard2 = createKeycard(new THREE.Vector3(5.5, 1, -10));
const keycard3 = createKeycard(new THREE.Vector3(0, 1, -13));

interactionSystem.register(keycard1);
interactionSystem.register(keycard2);
interactionSystem.register(keycard3);

minimap.addMarker(keycard1, 'keycard');
minimap.addMarker(keycard2, 'keycard');
minimap.addMarker(keycard3, 'keycard');

const level1Door = createDoor(new THREE.Vector3(0, 1.1, -16));
interactionSystem.register(level1Door);
minimap.addMarker(level1Door, 'door');

const level1WalkableAreas = [
  // Main corridor, including the final keycard and locked exit.
  { minX: -1.72, maxX: 1.72, minZ: -15.2, maxZ: 6.2 },
  // Maintenance Bay entrance and room interior.
  { minX: -6.05, maxX: -1.72, minZ: -7.05, maxZ: -2.95 },
  // Storage Bay entrance and room interior.
  { minX: 1.72, maxX: 6.05, minZ: -12.05, maxZ: -7.95 }
];

controls.setMovementConstraint((nextPosition) => {
  // Later levels retain their existing bounds once Level 1 is complete.
  if (level1Door.userData.isOpen) return true;

  const isInsideLevel1 = level1WalkableAreas.some((area) => (
    nextPosition.x >= area.minX &&
    nextPosition.x <= area.maxX &&
    nextPosition.z >= area.minZ &&
    nextPosition.z <= area.maxZ
  ));

  if (!isInsideLevel1) {
    hud.setMessage('Reactor access is locked — collect all three keycards.');
  }

  return isInsideLevel1;
});

controls.setCollisionBoxes([
  // Maintenance Bay crates and terminal.
  { minX: -5.9, maxX: -4.25, minZ: -4.7, maxZ: -3.75 },
  { minX: -5.9, maxX: -5.2, minZ: -6.15, maxZ: -5.65, padding: 0.12 },
  // Storage Bay crate stack and terminal.
  { minX: 4.35, maxX: 5.95, minZ: -9.5, maxZ: -8.7 },
  { minX: 5.2, maxX: 5.9, minZ: -11.15, maxZ: -10.65, padding: 0.12 }
]);

const checkpointPosition = new THREE.Vector3(0, 1.6, 6);
const level1CheckpointBeacon = createCheckpointBeacon(
  new THREE.Vector3(checkpointPosition.x, 0, checkpointPosition.z)
);
scene.add(level1CheckpointBeacon);
minimap.addMarker(level1CheckpointBeacon, 'checkpoint');

const steamVents = [
  createSteamVent(new THREE.Vector3(0, 0, -6.5))
];

for (const vent of steamVents) {
  scene.add(vent);
  minimap.addMarker(vent, 'hazard');
}
const powerJunctions = [
  createPowerJunction(new THREE.Vector3(-2, 1.4, -26), 1),
  createPowerJunction(new THREE.Vector3(0, 1.4, -26), 2),
  createPowerJunction(new THREE.Vector3(2, 1.4, -26), 3)
];

const reactorConsole = createReactorConsole(
  new THREE.Vector3(0, 0.8, -23)
);
const controlRoom = createControlRoom(new THREE.Vector3(0, 0, -22));
scene.add(controlRoom);

for (const junction of powerJunctions) {
  interactionSystem.register(junction);
}

const level2CheckpointPosition = new THREE.Vector3(0, 1.6, -19);

const securityBeams = [
  createSecurityBeam(new THREE.Vector3(0, 0, -23))
];

for (const beam of securityBeams) {
  scene.add(beam);
}

const meltdownCorridor = createCorridorSegment(18, 4, 3);
meltdownCorridor.position.z = -34;
scene.add(meltdownCorridor);

const reactorCore = createReactorCore(new THREE.Vector3(0, 1.5, -42));
scene.add(reactorCore);
minimap.addMarker(reactorCore, 'core');

const level3Timer = new LevelTimer(45);
level3Timer.stop();

let gameOver = false;
let lastPhase = '';

scene.add(reactorConsole);

const level3CheckpointPosition = new THREE.Vector3(0, 1.6, -30);
const collapseChunks = createCollapseSequence();

for (const chunk of collapseChunks) {
  scene.add(chunk);
}

let collapseStarted = false;

const levelTitle = new LevelTitle();
levelTitle.show('Level 1 - Corridors');

const overlay = new GameOverlay();
overlay.showMenu();

overlay.onStart = () => {
  renderer.domElement.requestPointerLock();
};

overlay.onRestart = () => {
  window.location.reload();
};


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  if (!overlay.isPlaying()) {
    renderer.render(scene, camera);
    return;
  }

  controls.update(delta);
  interactionSystem.update(delta);

  for (const vent of steamVents) {
    vent.userData.update(delta);
  }

  const wasHitBySteam = checkSteamVentHit(
    controls.getPlayerPosition(),
    steamVents
  );

  if (wasHitBySteam) {
    controls.respawn(checkpointPosition);
    hud.setMessage('Steam vent hit you - returned to checkpoint');
  }

  for (const beam of securityBeams) {
    beam.userData.update(delta);
  }

  const wasHitByBeam = checkSecurityBeamHit(
    camera,
    securityBeams,
    level2CheckpointPosition
  );

  if (wasHitByBeam) {
    controls.respawn(level2CheckpointPosition);
    hud.setMessage('Security beam hit you - returned to control room entrance');
  }

  const isPuzzleComplete = updatePowerPuzzle(powerJunctions, reactorConsole);

  const playerZ = controls.getPlayerPosition().z;
  const inLevel2 = playerZ <= -18 && playerZ > -30;
  const inLevel3 = playerZ <= -30;

  if (inLevel2 && lastPhase !== 'level2') {
    level2Timer.reset();
    hud.setMessage('Power routing online. Follow the blue, yellow, then green path.');
  }

  if (inLevel3 && lastPhase !== 'level3') {
    level3Timer.reset();
    collapseStarted = true;
    hud.setMessage('MELTDOWN SEQUENCE STARTED - sprint to the core!');
  }

  if (inLevel2 && !isPuzzleComplete) level2Timer.update(delta);
  lastPhase = inLevel3 ? 'level3' : inLevel2 ? 'level2' : 'level1';

  if (isPuzzleComplete) {
    level2Timer.stop();
  }

  if (level2Timer.isFinished() && !reactorConsole.userData.isComplete) {
    controls.respawn(level2CheckpointPosition);
    resetPowerPuzzle(powerJunctions, reactorConsole);
    level2Timer.reset();
    hud.setMessage('Timer expired - puzzle reset');
  }

  hud.update();

  function updateLevelTitle() {
    const playerZ = controls.getPlayerPosition().z;

    if (playerZ > -18) {
      levelTitle.show('Level 1 - Corridors');
    } else if (playerZ > -30) {
      levelTitle.show('Level 2 - Control Room');
    } else {
      levelTitle.show('Level 3 - Meltdown');
    }
  }

  if (!gameOver) {
    reactorCore.userData.update(delta);

    const playerInLevel3 = controls.getPlayerPosition().z < -30;

    if (playerInLevel3) {
      collapseStarted = true;
    }

    if (playerInLevel3 && !reactorCore.userData.isSealed) {
      level3Timer.update(delta);

      setHudPhase(`MELTDOWN: reach the core  |  ${level3Timer.getDisplayTime()}s`);

      updateCollapseSequence(collapseChunks, delta, collapseStarted);

      const wasHitByCollapse = checkCollapseHit(
        camera,
        collapseChunks,
        level3CheckpointPosition
      );

      if (wasHitByCollapse) {
        collapseStarted = false;
        resetCollapseSequence(collapseChunks);
        level3Timer.reset();
        controls.respawn(level3CheckpointPosition);
        hud.setMessage('Corridor collapsed - returned to Level 3 entrance');
      }

      if (checkCoreReached(camera, reactorCore)) {
        reactorCore.userData.seal();
        level3Timer.stop();
        gameOver = true;
        hud.setMessage('Core sealed - station saved');
        overlay.showWin();

      }

      if (level3Timer.isFinished()) {
        gameOver = true;
        hud.setMessage('Meltdown - station lost');
        console.log('Meltdown - station lost');
        overlay.showGameOver();
      }
    }
  }
  for (const beacon of level1HintBeacons) {
    beacon.userData.update(delta);
  }
  for (const prop of level1AnimatedProps) {
    prop.userData.update?.(objectiveTracker, delta);
  }
  level1CheckpointBeacon.userData.update(delta);
  minimap.update(delta);
  updateLevelTitle();
  levelTitle.update(delta);

  renderer.render(scene, camera);

}

animate();
