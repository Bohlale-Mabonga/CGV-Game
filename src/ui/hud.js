export class HUD {
    constructor(objectiveTracker) {
        this.objectiveTracker = objectiveTracker;
        this.levelTimer = null;
        this.currentPhase = 'Find keycards, then route power in the control room';

        this.container = document.createElement('div');
        this.container.className = 'hud';

        this.kickerText = document.createElement('div');
        this.kickerText.className = 'hud-kicker';
        this.kickerText.textContent = 'CORE BREACH // MAINTENANCE UNIT';

        this.objectiveText = document.createElement('div');
        this.objectiveText.className = 'hud-objective';

        this.keycardText = document.createElement('div');
        this.keycardText.className = 'hud-keycards';

        this.keycardBar = document.createElement('div');
        this.keycardBar.className = 'hud-progress';
        this.keycardFill = document.createElement('div');
        this.keycardFill.className = 'hud-progress-fill hud-progress-keycards';
        this.keycardBar.appendChild(this.keycardFill);

        this.timerText = document.createElement('div');
        this.timerText.className = 'hud-timer';

        this.timerBar = document.createElement('div');
        this.timerBar.className = 'hud-progress';
        this.timerFill = document.createElement('div');
        this.timerFill.className = 'hud-progress-fill hud-progress-timer';
        this.timerBar.appendChild(this.timerFill);

        this.staminaText = document.createElement('div');
        this.staminaText.className = 'hud-stamina';

        this.staminaBar = document.createElement('div');
        this.staminaBar.className = 'hud-progress';
        this.staminaFill = document.createElement('div');
        this.staminaFill.className = 'hud-progress-fill hud-progress-stamina';
        this.staminaBar.appendChild(this.staminaFill);

        this.hintText = document.createElement('div');
        this.hintText.className = 'hud-hint';
        this.hintText.textContent = 'WASD move  |  Shift sprint  |  E interact  |  V camera';

        this.messageText = document.createElement('div');
        this.messageText.className = 'hud-message';

        this.container.appendChild(this.kickerText);
        this.container.appendChild(this.objectiveText);
        this.container.appendChild(this.keycardText);
        this.container.appendChild(this.keycardBar);
        this.container.appendChild(this.timerText);
        this.container.appendChild(this.timerBar);
        this.container.appendChild(this.staminaText);
        this.container.appendChild(this.staminaBar);
        this.container.appendChild(this.messageText);
        this.container.appendChild(this.hintText);

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

    setStamina(value, maxValue, isSprinting = false) {
        const percentage = Math.max(0, Math.min(100, (value / maxValue) * 100));
        this.staminaText.textContent = `SUIT CHARGE  ${Math.ceil(value)}%${isSprinting ? '  // BOOST' : ''}`;
        this.staminaFill.style.width = `${percentage}%`;
        this.staminaText.style.color = value < maxValue * 0.25 ? '#ff6677' : '#9de7ff';
        this.staminaFill.classList.toggle('is-low', value < maxValue * 0.25);
    }

    setPhase(phase) {
        this.currentPhase = phase;
        this.objectiveText.textContent = phase;
    }

    update() {
        this.objectiveText.textContent = this.currentPhase;

        const keycardPercentage = Math.min(
            100,
            (this.objectiveTracker.keycardsCollected / this.objectiveTracker.requiredKeycards) * 100
        );
        this.keycardText.textContent =
            `KEYCARDS  ${this.objectiveTracker.keycardsCollected} / ${this.objectiveTracker.requiredKeycards}`;
        this.keycardFill.style.width = `${keycardPercentage}%`;

        if (this.levelTimer && this.levelTimer.isRunning) {
            const seconds = this.levelTimer.getDisplayTime();
            const timerPercentage = Math.max(0, Math.min(100, (seconds / this.levelTimer.duration) * 100));
            this.timerText.textContent = `CONTROL ROOM TIMER  ${seconds}s`;
            this.timerFill.style.width = `${timerPercentage}%`;
            this.timerText.style.color = seconds <= 10 ? '#ff6677' : '#ff9f43';
            this.timerFill.classList.toggle('is-low', seconds <= 10);
        } else {
            this.timerText.textContent = '';
            this.timerFill.style.width = '0%';
        }
    }

    setMessage(message) {
        this.messageText.textContent = message;
    }
}
