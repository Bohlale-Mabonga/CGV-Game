export class InteractionSystem {
  constructor(camera, scene, objectiveTracker, hud, range = 2) {
    this.camera = camera;
    this.scene = scene;
    this.objectiveTracker = objectiveTracker;
    this.hud = hud;
    this.range = range;
    this.interactables = [];
    this.nearestInteractable = null;

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && this.nearestInteractable) {
        this.nearestInteractable.userData.onInteract(
          this.objectiveTracker,
          this.scene
        );
      }
    });
  }

  register(mesh) {
    this.interactables.push(mesh);
    this.scene.add(mesh);
  }

  update(delta) {
    this.nearestInteractable = null;

    const playerPos = this.camera.position;

    for (const obj of [...this.interactables]) {
      if (obj.userData.update) {
        obj.userData.update(this.objectiveTracker, delta);
      }

      const dist = playerPos.distanceTo(obj.position);

      if (dist > this.range) continue;

      if (obj.userData.type === 'keycard') {
        obj.userData.onInteract(this.objectiveTracker, this.scene);

        this.interactables = this.interactables.filter((o) => o !== obj);

        this.hud.setMessage('Keycard collected');
      } else if (
        obj.userData.type === 'door' ||
        obj.userData.type === 'junction'
      ) {
        this.nearestInteractable = obj;

        if (obj.userData.type === 'door') {
          this.hud.setMessage('Press E to open door');
        }

        if (obj.userData.type === 'junction') {
          this.hud.setMessage('Press E to toggle power junction');
        }
      }
    }
  }
}