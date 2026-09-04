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

import { createLevel1Props } from './world/level1-props.js';
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

const leftRoom = createSideRoom(4, 4, 3);
leftRoom.position.set(-4, 0, -5);
leftRoom.rotation.y = -Math.PI / 2;
scene.add(leftRoom);

const rightRoom = createSideRoom(4, 4, 3);
rightRoom.position.set(4, 0, -10);
rightRoom.rotation.y = Math.PI / 2;
scene.add(rightRoom);

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
controls.onViewModeChange = (viewMode) => {
  hud.setMessage(
    viewMode === 'firstPerson'
      ? 'First-person view'
      : 'Third-person view'
  );
};
const level2Timer = new LevelTimer(60);
hud.setLevelTimer(level2Timer);

const interactionSystem = new InteractionSystem(
  camera,
  scene,
  objectiveTracker,
  hud
);

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

const checkpointPosition = new THREE.Vector3(0, 1.6, 6);

const steamVents = [
  createSteamVent(new THREE.Vector3(0, 0, -6.5))
];

for (const vent of steamVents) {
  scene.add(vent);
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
let gameOver = false;

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

  const delta = clock.getDelta();
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
    camera,
    steamVents,
    checkpointPosition
  );

  if (wasHitBySteam) {
    hud.setMessage('Steam vent hit you - returned to checkpoint');
  }

  updatePowerPuzzle(powerJunctions, reactorConsole);

  for (const beam of securityBeams) {
    beam.userData.update(delta);
  }

  const wasHitByBeam = checkSecurityBeamHit(
    camera,
    securityBeams,
    level2CheckpointPosition
  );

  if (wasHitByBeam) {
    hud.setMessage('Security beam hit you - returned to control room entrance');
  }

  level2Timer.update(delta);

  const isPuzzleComplete = updatePowerPuzzle(powerJunctions, reactorConsole);

  if (isPuzzleComplete) {
    level2Timer.stop();
  }

  if (level2Timer.isFinished() && !reactorConsole.userData.isComplete) {
    camera.position.copy(level2CheckpointPosition);
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

    const playerInLevel3 = camera.position.z < -30;

    if (playerInLevel3) {
      collapseStarted = true;
    }

    if (playerInLevel3 && !reactorCore.userData.isSealed) {
      level3Timer.update(delta);

      hud.setMessage(`Meltdown Timer: ${level3Timer.getDisplayTime()}s`);

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
  interactionSystem.update(delta);
  for (const beacon of level1HintBeacons) {
    beacon.userData.update(delta);
  }
  minimap.addMarker(reactorCore, 'core');
  minimap.update(delta);
  updateLevelTitle();
  levelTitle.update(delta);

  renderer.render(scene, camera);

}

animate();