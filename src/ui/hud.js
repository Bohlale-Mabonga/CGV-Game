export class HUD {
    constructor(objectiveTracker) {
        this.objectiveTracker = objectiveTracker;
        this.levelTimer = null;

        this.container = document.createElement('div');
        this.container.className = 'hud';

        this.objectiveText = document.createElement('div');
        this.objectiveText.className = 'hud-objective';

        this.keycardText = document.createElement('div');
        this.keycardText.className = 'hud-keycards';

        this.timerText = document.createElement('div');
        this.timerText.className = 'hud-timer';

        this.messageText = document.createElement('div');
        this.messageText.className = 'hud-message';

        this.container.appendChild(this.objectiveText);
        this.container.appendChild(this.keycardText);
        this.container.appendChild(this.timerText);
        this.container.appendChild(this.messageText);

        document.body.appendChild(this.container);

        this.setMessage('Click to lock mouse. Use WASD to move.');
        this.update();

        this.objectiveTracker.onChange = () => {
            this.update();
        };
    }

    setLevelTimer(levelTimer) {
        this.levelTimer = levelTimer;
    }

    update() {
        this.objectiveText.textContent =
            'Find keycards, then route power in the control room';

        this.keycardText.textContent =
            `Keycards: ${this.objectiveTracker.keycardsCollected} / ${this.objectiveTracker.requiredKeycards}`;

        if (this.levelTimer) {
            this.timerText.textContent =
                `Control Room Timer: ${this.levelTimer.getDisplayTime()}s`;
        } else {
            this.timerText.textContent = '';
        }
    }

    setMessage(message) {
        this.messageText.textContent = message;
    }
}