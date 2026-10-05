export class StationAudio {
    constructor() {
        this.context = null;
        this.master = null;
        this.ambient = null;
    }

    start() {
        if (this.context) {
            this.context.resume();
            return;
        }
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.08;
        this.master.connect(this.context.destination);

        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 48;
        gain.gain.value = 0.18;
        oscillator.connect(gain).connect(this.master);
        oscillator.start();
        this.ambient = oscillator;
    }

    pulse(frequency = 220, duration = 0.12, volume = 0.16) {
        if (!this.context || !this.master) return;
        const now = this.context.currentTime;
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.55, now + duration);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        oscillator.connect(gain).connect(this.master);
        oscillator.start(now);
        oscillator.stop(now + duration);
    }

    alarm() {
        this.pulse(740, 0.18, 0.2);
        window.setTimeout(() => this.pulse(430, 0.2, 0.15), 190);
    }
}
