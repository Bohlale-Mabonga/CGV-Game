import * as THREE from 'three';

// Keycards auto-collect when you walk close enough.
// The door needs you nearby AND pressing E.
export class InteractionSystem {
  constructor(camera, scene, objectiveTracker, range = 2) {
    this.camera = camera;
    this.scene = scene;
    this.objectiveTracker = objectiveTracker;
    this.range = range;
    this.interactables = [];
    this.nearestDoor = null;

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && this.nearestDoor) {
        this.nearestDoor.userData.onInteract(this.objectiveTracker, this.scene);
      }
    });
  }

  register(mesh) {
    this.interactables.push(mesh);
    this.scene.add(mesh);
  }

  update() {
    this.nearestDoor = null;
    const playerPos = this.camera.position;

    for (const obj of [...this.interactables]) {
      const dist = playerPos.distanceTo(obj.position);
      if (dist > this.range) continue;

      if (obj.userData.type === 'keycard') {
        obj.userData.onInteract(this.objectiveTracker, this.scene);
        this.interactables = this.interactables.filter((o) => o !== obj);
      } else if (obj.userData.type === 'door') {
        this.nearestDoor = obj;
      }
    }
  }
}