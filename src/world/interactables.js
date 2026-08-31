import * as THREE from 'three';

export function createKeycard(position) {
  const geometry = new THREE.BoxGeometry(0.3, 0.02, 0.4);

  const material = new THREE.MeshStandardMaterial({
    color: 0x37c8ff,
    emissive: 0x0a3a4a,
    emissiveIntensity: 1
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.rotation.x = Math.PI / 2;

  mesh.userData.interactable = true;
  mesh.userData.type = 'keycard';

  mesh.userData.onInteract = (objectiveTracker, scene) => {
    objectiveTracker.collectKeycard();
    scene.remove(mesh);
  };

  return mesh;
}

export function createDoor(position) {
  const geometry = new THREE.BoxGeometry(1.2, 2.2, 0.15);

  const material = new THREE.MeshStandardMaterial({
    color: 0x8a5a2b
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);

  mesh.userData.interactable = true;
  mesh.userData.type = 'door';
  mesh.userData.isOpen = false;

  mesh.userData.onInteract = (objectiveTracker) => {
    if (mesh.userData.isOpen) return 'alreadyOpen';

    if (objectiveTracker.isObjectiveComplete()) {
      mesh.userData.isOpen = true;
      objectiveTracker.openDoor();

      mesh.position.y += 2.2;

      console.log('Door opened - objective complete!');
      return 'opened';
    }

    console.log('Door locked - find the remaining keycards first.');
    return 'locked';
  };

  return mesh;
}