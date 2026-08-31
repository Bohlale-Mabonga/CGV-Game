// Tracks progress toward a level's objective.
// Level 1's objective: collect all keycards, then the door can open.
export class ObjectiveTracker {
  constructor(requiredKeycards = 3) {
    this.requiredKeycards = requiredKeycards;
    this.keycardsCollected = 0;
  }

  collectKeycard() {
    this.keycardsCollected++;
    console.log(`Keycard collected: ${this.keycardsCollected}/${this.requiredKeycards}`);
  }

  isObjectiveComplete() {
    return this.keycardsCollected >= this.requiredKeycards;
  }
}
