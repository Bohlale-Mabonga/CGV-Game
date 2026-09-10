export class InteractionSystem {
  constructor(camera, scene, objectiveTracker, hud, range = 2, getPlayerPosition) {
    this.camera = camera;
    this.scene = scene;
    this.objectiveTracker = objectiveTracker;
    this.hud = hud;
    this.range = range;
    this.interactables = [];
    this.nearestInteractable = null;
    this.lastPrompt = '';
    this.getPlayerPosition = getPlayerPosition ?? (() => this.camera.position);

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && !e.repeat && this.nearestInteractable) {
        const result = this.nearestInteractable.userData.onInteract(
          this.objectiveTracker,
          this.scene
        );

        if (result?.message) this.hud.setMessage(result.message);
      }
    });
  }

  register(mesh) {
    this.interactables.push(mesh);
    this.scene.add(mesh);
  }

  update(delta) {
    this.nearestInteractable = null;

    const playerPos = this.getPlayerPosition();
    let nearestDistance = Infinity;

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
      } else if (obj.userData.interactable) {
        if (dist >= nearestDistance) continue;

        this.nearestInteractable = obj;
        nearestDistance = dist;

        const prompt = obj.userData.prompt || 'Press E to interact';
        if (prompt !== this.lastPrompt) {
          this.hud.setMessage(prompt);
          this.lastPrompt = prompt;
        }
      }
    }

    if (!this.nearestInteractable) this.lastPrompt = '';
  }
}
