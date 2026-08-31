export class LevelTimer {
    constructor(duration) {
        this.duration = duration;
        this.timeRemaining = duration;
        this.isRunning = true;
    }

    update(delta) {
        if (!this.isRunning) return;

        this.timeRemaining -= delta;

        if (this.timeRemaining < 0) {
            this.timeRemaining = 0;
        }
    }

    reset() {
        this.timeRemaining = this.duration;
        this.isRunning = true;
    }

    stop() {
        this.isRunning = false;
    }

    isFinished() {
        return this.timeRemaining <= 0;
    }

    getDisplayTime() {
        return Math.ceil(this.timeRemaining);
    }
}