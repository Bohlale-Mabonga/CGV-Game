export class InteractionSystem {
  constructor(camera, scene, objectiveTracker, hud, range = 2) {
    this.camera = camera;
    this.scene = scene;
    this.objectiveTracker = objectiveTracker;
    this.hud = hud;
    this.range = range;
    this.interactables = [];
    this.nearestDoor = null;

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && this.nearestDoor) {
        const result = this.nearestDoor.userData.onInteract(
          this.objectiveTracker,
          this.scene
        );

        if (result === 'opened') {
          this.hud.setMessage('Door opened - Level 1 complete', 4);
        } else if (result === 'locked') {
          this.hud.setMessage('Door locked - find remaining keycards', 3);
        }
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

        this.hud.setMessage('Keycard collected', 2);
      } else if (obj.userData.type === 'door' && !obj.userData.isOpen) {
        this.nearestDoor = obj;
        this.hud.setMessage('Press E to open door', 0.2);
      }
    }
  }
}