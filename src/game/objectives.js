export class ObjectiveTracker {
  constructor(requiredKeycards = 3) {
    this.requiredKeycards = requiredKeycards;
    this.keycardsCollected = 0;
    this.onChange = null;
  }

  collectKeycard() {
    this.keycardsCollected++;

    console.log(
      `Keycard collected: ${this.keycardsCollected}/${this.requiredKeycards}`
    );

    if (this.onChange) {
      this.onChange();
    }
  }

  isObjectiveComplete() {
    return this.keycardsCollected >= this.requiredKeycards;
  }
}