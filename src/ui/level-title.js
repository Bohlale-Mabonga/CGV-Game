export class LevelTitle {
    constructor() {
        this.currentLevel = null;
        this.timer = 0;

        this.container = document.createElement('div');
        this.container.className = 'level-title';
        document.body.appendChild(this.container);
    }

    show(title) {
        if (this.currentLevel === title) return;

        this.currentLevel = title;
        this.timer = 3;

        this.container.textContent = title;
        this.container.classList.add('visible');
    }

    update(delta) {
        if (this.timer <= 0) return;

        this.timer -= delta;

        if (this.timer <= 0) {
            this.container.classList.remove('visible');
        }
    }
}