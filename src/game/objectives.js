export class ObjectiveTracker {
  constructor(requiredKeycards = 3) {
    this.requiredKeycards = requiredKeycards;
    this.keycardsCollected = 0;
    this.onChange = null;
  }

  collectKeycard() {
    this.keycardsCollected = Math.min(this.requiredKeycards, this.keycardsCollected + 1);

    console.log(
      `Keycard collected: ${this.keycardsCollected}/${this.requiredKeycards}`
    );

    if (this.onChange) {
      this.onChange();
    }
  }

  restoreKeycards(count) {
    this.keycardsCollected = Math.min(this.requiredKeycards, Math.max(0, count));
    if (this.onChange) this.onChange();
  }

  isObjectiveComplete() {
    return this.keycardsCollected >= this.requiredKeycards;
  }
}
