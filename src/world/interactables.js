import * as THREE from 'three';

// A keycard the player can pick up. Removes itself from the scene
// and reports collection to the objective tracker.
export function createKeycard(position) {
  const geometry = new THREE.BoxGeometry(0.3, 0.02, 0.4);
  const material = new THREE.MeshStandardMaterial({ color: 0x37c8ff, emissive: 0x0a3a4a });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);

  mesh.userData.interactable = true;
  mesh.userData.type = 'keycard';
  mesh.userData.onInteract = (objectiveTracker, scene) => {
    objectiveTracker.collectKeycard();
    scene.remove(mesh);
  };

  return mesh;
}

// A door that stays shut until the objective is complete.
// onInteract checks the objective every time the player tries it.
export function createDoor(position) {
  const geometry = new THREE.BoxGeometry(1.2, 2.2, 0.15);
  const material = new THREE.MeshStandardMaterial({ color: 0x8a5a2b });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);

  mesh.userData.interactable = true;
  mesh.userData.type = 'door';
  mesh.userData.isOpen = false;

  mesh.userData.onInteract = (objectiveTracker, scene) => {
    if (mesh.userData.isOpen) return;
    if (objectiveTracker.isObjectiveComplete()) {
      mesh.userData.isOpen = true;
      mesh.position.y += 2.2; 
      console.log('Door opened — objective complete!');
    } else {
      console.log('Door locked — find the remaining keycards first.');
    }
  };

  return mesh;
}
