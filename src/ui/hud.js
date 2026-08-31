export class HUD {
    constructor(objectiveTracker) {
        this.objectiveTracker = objectiveTracker;

        this.container = document.createElement('div');
        this.container.className = 'hud';

        this.objectiveText = document.createElement('div');
        this.objectiveText.className = 'hud-objective';

        this.keycardText = document.createElement('div');
        this.keycardText.className = 'hud-keycards';

        this.messageText = document.createElement('div');
        this.messageText.className = 'hud-message';

        this.container.appendChild(this.objectiveText);
        this.container.appendChild(this.keycardText);
        this.container.appendChild(this.messageText);

        document.body.appendChild(this.container);

        this.setMessage('Click to lock mouse. Use WASD to move.');
        this.update();

        this.objectiveTracker.onChange = () => {
            this.update();
        };
    }

    update() {
        this.objectiveText.textContent =
            'Find all keycards, then open the reactor door';

        this.keycardText.textContent =
            `Keycards: ${this.objectiveTracker.keycardsCollected} / ${this.objectiveTracker.requiredKeycards}`;
    }

    setMessage(message) {
        this.messageText.textContent = message;
    }
}