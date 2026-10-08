export class GameOverlay {
    constructor() {
        this.state = 'menu';
        this.onStart = null;
        this.onRestart = null;

        this.container = document.createElement('div');
        this.container.className = 'game-overlay';

        this.title = document.createElement('h1');
        this.title.textContent = 'Core Breach';

        this.subtitle = document.createElement('p');
        this.subtitle.textContent =
            'Seal the reactor core before the station melts down.';

        this.primaryButton = document.createElement('button');
        this.primaryButton.textContent = 'Start';

        this.secondaryButton = document.createElement('button');
        this.secondaryButton.textContent = 'Restart';

        this.container.appendChild(this.title);
        this.container.appendChild(this.subtitle);
        this.container.appendChild(this.primaryButton);
        this.container.appendChild(this.secondaryButton);

        document.body.appendChild(this.container);

        this.secondaryButton.style.display = 'none';

        this.primaryButton.addEventListener('click', () => {
            if (this.state === 'menu' || this.state === 'paused') {
                this.hide();
                this.state = 'playing';

                if (this.onStart) {
                    this.onStart();
                }
            }
        });

        this.secondaryButton.addEventListener('click', () => {
            if (this.onRestart) {
                this.onRestart();
            }

            this.hide();
            this.state = 'playing';
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.state === 'playing') {
                    this.showPause();
                } else if (this.state === 'paused') {
                    this.hide();
                    this.state = 'playing';
                }
            }

            if (e.code === 'KeyR' && this.state !== 'menu') {
                if (this.onRestart) {
                    this.onRestart();
                }

                this.hide();
                this.state = 'playing';
            }
        });
    }

    isPlaying() {
        return this.state === 'playing';
    }

    hide() {
        this.container.style.display = 'none';
    }

    showMenu() {
        this.state = 'menu';
        this.container.style.display = 'flex';
        this.title.textContent = 'Core Breach';
        this.subtitle.textContent =
            'Seal the reactor core before the station melts down.';
        this.primaryButton.textContent = 'Start';
        this.secondaryButton.style.display = 'none';
    }

    showPause() {
        this.state = 'paused';
        this.container.style.display = 'flex';
        this.title.textContent = 'Paused';
        this.subtitle.textContent = 'Resume or restart the current run.';
        this.primaryButton.textContent = 'Resume';
        this.secondaryButton.style.display = 'inline-block';
    }

    showWin() {
        this.state = 'win';
        this.container.style.display = 'flex';
        this.title.textContent = 'Core Sealed';
        this.subtitle.textContent = 'Station saved. Prototype complete.';
        this.primaryButton.style.display = 'none';
        this.secondaryButton.style.display = 'inline-block';
    }

    showGameOver() {
        this.state = 'gameOver';
        this.container.style.display = 'flex';
        this.title.textContent = 'Meltdown';
        this.subtitle.textContent = 'The reactor reached critical failure.';
        this.primaryButton.style.display = 'none';
        this.secondaryButton.style.display = 'inline-block';
    }
}