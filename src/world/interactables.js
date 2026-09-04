import * as THREE from 'three';

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

  mesh.userData.interactable = true;
  mesh.userData.type = 'door';
  mesh.userData.highlightTarget = mesh;
  mesh.userData.isOpen = false;
  mesh.userData.isUnlocked = false;

  mesh.userData.update = (objectiveTracker) => {
    if (!mesh.userData.isOpen && objectiveTracker.isObjectiveComplete()) {
      mesh.userData.isUnlocked = true;
      mesh.material = unlockedMaterial;
      scanner.material.color.set(0x37ff8b);
      scannerLight.color.set(0x37ff8b);
    }
  };

  mesh.userData.onInteract = (objectiveTracker) => {
    if (mesh.userData.isOpen) return;

    if (objectiveTracker.isObjectiveComplete()) {
      mesh.userData.isOpen = true;
      mesh.userData.ignoreCollision = true;
      mesh.position.y += 2.2;
      console.log('Door opened - objective complete!');
    } else {
      console.log('Door locked - find the remaining keycards first.');
    }
  };

  return mesh;
}