import * as THREE from 'three';

import { createSign } from './signage.js';

export function createKeycard(position) {
  const group = new THREE.Group();
  group.position.copy(position);

  const card = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.04, 0.48),
    new THREE.MeshStandardMaterial({
      color: 0x37c8ff,
      emissive: 0x0a3a4a,
      emissiveIntensity: 1.5
    })
  );

  card.rotation.x = Math.PI / 2;
  group.add(card);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.018, 8, 24),
    new THREE.MeshBasicMaterial({
      color: 0x37c8ff,
      transparent: true,
      opacity: 0.8
    })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.08;
  group.add(halo);

  const glow = new THREE.PointLight(0x37c8ff, 1.2, 2);
  glow.position.set(0, 0.2, 0);
  group.add(glow);

  group.userData.interactable = true;
  group.userData.type = 'keycard';
  group.userData.highlightTarget = card;
  group.userData.baseY = position.y;

  group.userData.update = (objectiveTracker, delta) => {
    group.rotation.y += delta * 2.5;
    group.position.y =
      group.userData.baseY + Math.sin(Date.now() * 0.004) * 0.12;

    const haloScale = 1 + Math.sin(Date.now() * 0.005) * 0.12;
    halo.scale.set(haloScale, haloScale, haloScale);

    const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.35;
    glow.intensity = pulse;
  };

  group.userData.onInteract = (objectiveTracker, scene) => {
    objectiveTracker.collectKeycard();
    scene.remove(group);
  };

  return group;
}

export function createDoor(position) {
  const closedMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a5a2b
  });

  const unlockedMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f9e44,
    emissive: 0x0f3d1c,
    emissiveIntensity: 0.5
  });

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.2, 0.15),
    closedMaterial
  );

  mesh.position.copy(position);

  const scanner = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.35, 0.04),
    new THREE.MeshBasicMaterial({
      color: 0xff3344
    })
  );
  scanner.position.set(0.75, 0.25, 0.1);
  mesh.add(scanner);

  const scannerLight = new THREE.PointLight(0xff3344, 1, 2);
  scannerLight.position.set(0.75, 0.25, 0.2);
  mesh.add(scannerLight);

  const doorLight = new THREE.PointLight(0xff3344, 1.1, 3);
  doorLight.position.set(0, 1.3, 0.3);
  mesh.add(doorLight);

  const counterSign = createSign(
    '0 / 3',
    new THREE.Vector3(0, 0.55, 0.09),
    0,
    {
      widthWorld: 0.75,
      heightWorld: 0.25,
      width: 512,
      height: 180,
      fontSize: 70,
      border: '#ff3344',
      color: '#ffdddd',
      background: '#140808'
    }
  );
  mesh.add(counterSign);

  mesh.userData.interactable = true;
  mesh.userData.type = 'door';
  mesh.userData.prompt = 'Press E to unlock the reactor access door';
  mesh.userData.highlightTarget = mesh;
  mesh.userData.isOpen = false;
  mesh.userData.isUnlocked = false;
  mesh.userData.lastKeycardCount = -1;
  mesh.userData.closedY = position.y;
  mesh.userData.openY = position.y + 2.2;

  mesh.userData.update = (objectiveTracker, delta = 0) => {
    if (mesh.userData.lastKeycardCount !== objectiveTracker.keycardsCollected) {
      mesh.userData.lastKeycardCount = objectiveTracker.keycardsCollected;

      const isComplete = objectiveTracker.isObjectiveComplete();

      counterSign.userData.setText(
        `${objectiveTracker.keycardsCollected} / ${objectiveTracker.requiredKeycards}`,
        {
          border: isComplete ? '#37ff8b' : '#ff3344',
          color: isComplete ? '#ddffea' : '#ffdddd',
          background: isComplete ? '#061b10' : '#140808'
        }
      );
    }

    if (!mesh.userData.isOpen && objectiveTracker.isObjectiveComplete()) {
      mesh.userData.isUnlocked = true;
      mesh.material = unlockedMaterial;
      scanner.material.color.set(0x37ff8b);
      scannerLight.color.set(0x37ff8b);
      doorLight.color.set(0x37ff8b);
      mesh.userData.prompt = 'Press E to open the reactor access door';
    }

    scannerLight.intensity = mesh.userData.isUnlocked
      ? 0.75 + Math.sin(performance.now() * 0.008) * 0.25
      : 1;

    if (mesh.userData.isOpen) {
      mesh.position.y = Math.min(
        mesh.userData.openY,
        mesh.position.y + delta * 3.5
      );
    }
  };

  mesh.userData.onInteract = (objectiveTracker) => {
    if (mesh.userData.isOpen) return;

    if (objectiveTracker.isObjectiveComplete()) {
      mesh.userData.isOpen = true;
      mesh.userData.ignoreCollision = true;
      console.log('Door opened - objective complete!');
      return { message: 'Reactor access unlocked. Proceed to the control room.' };
    } else {
      console.log('Door locked - find the remaining keycards first.');
      return {
        message: `Door locked — ${objectiveTracker.requiredKeycards - objectiveTracker.keycardsCollected} keycard(s) remaining.`
      };
    }
  };

  return mesh;
}
