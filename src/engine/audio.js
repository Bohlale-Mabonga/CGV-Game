
import { settings } from './settings.js';

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------------------
// Track definitions. Chords are MIDI note lists, one chord per bar (16 steps).
// Each layer receives the step, the bar's chord and the current intensity.
// ---------------------------------------------------------------------------
const TRACKS = {
  menu: {
    bpm: 78,
    chords: [[57, 60, 64, 71], [53, 57, 60, 64], [50, 53, 57, 62], [52, 56, 59, 64]],
    layers(a, s, chord, t, i, bar) {
      if (s === 0) a.pad(t, chord, a.barLength * 1.05, 0.05, 900);
      if (s === 0 || s === 8) a.bass(t, chord[0] - 12, a.stepLength * 6, 0.12, 380);
      if (s % 2 === 0) {
        const arp = [0, 1, 2, 3, 2, 1, 3, 2];
        const note = chord[arp[(s / 2) % 8]] + 12;
        a.pluck(t, note, 0.35, 0.035, 'triangle');
      }
      if (bar % 2 === 1 && s === 12) a.bell(t, chord[3] + 24, 0.03);
    }
  },
  level1: {
    bpm: 66,
    chords: [[45, 52, 59, 60], [41, 48, 55, 57], [45, 52, 59, 64], [40, 47, 55, 59]],
    layers(a, s, chord, t, i, bar) {
      if (s === 0) {
        a.drone(t, chord[0] - 12, a.barLength * 1.1, 0.11);
        a.pad(t, chord.slice(1), a.barLength * 1.1, 0.035, 520);
      }
      // Sparse minor-pentatonic plinks, like distant pipes cooling.
      const penta = [69, 72, 74, 76, 79, 81];
      if (s % 2 === 0 && Math.random() < 0.16 + i * 0.2) {
        a.pluck(t, penta[(Math.random() * penta.length) | 0], 0.6, 0.03, 'sine');
      }
      // A heartbeat creeps in when the player is in danger.
      if (i > 0.45 && (s === 0 || s === 3)) a.kick(t, 0.22 * i, 60);
      if (s === 8 && bar % 4 === 3) a.bell(t, 88, 0.015);
    }
  },
  level2: {
    bpm: 112,
    chords: [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]],
    layers(a, s, chord, t, i, bar) {
      if (s === 0) a.pad(t, chord.slice(1), a.barLength, 0.03, 700 + i * 800);
      if (s % 2 === 0) a.bass(t, chord[0] - 12, a.stepLength * 1.6, 0.13, 500 + i * 900);
      const arp = [0, 2, 1, 3, 2, 3, 1, 2];
      a.pluck(t, chord[arp[s % 8]] + 12, 0.14, 0.022 + i * 0.012, 'square', 1800 + i * 2500);
      if (s % 4 === 0) a.tick(t, 0.05);
      if (i > 0.25 && s % 4 === 2) a.hat(t, 0.05);
      if (i > 0.5 && s % 4 === 0) a.kick(t, 0.32, 55);
      if (i > 0.75 && (s === 4 || s === 12)) a.snare(t, 0.12);
    }
  },
  level3: {
    bpm: 148,
    chords: [[52, 59, 64, 67], [48, 55, 60, 64], [50, 57, 62, 66], [47, 54, 59, 63]],
    layers(a, s, chord, t, i, bar) {
      if (s % 4 === 0) a.kick(t, 0.5, 50);
      if (s === 4 || s === 12) a.snare(t, 0.2);
      a.hat(t, s % 2 === 0 ? 0.05 : 0.025);
      if (s % 4 === 2 || s === 0) a.bass(t, chord[0] - 12, a.stepLength * 1.5, 0.16, 900 + i * 900);
      if (s === 0) a.pad(t, chord.slice(1), a.barLength, 0.028, 1400);
      if (bar % 2 === 0 && (s === 0 || s === 3 || s === 6)) a.stab(t, chord[1] + 12, 0.05);
      if (i > 0.6 && s % 2 === 1) a.pluck(t, chord[(s >> 1) % 4] + 24, 0.08, 0.02, 'sawtooth', 3000);
    }
  },
  victory: {
    bpm: 88,
    chords: [[48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]],
    layers(a, s, chord, t, i, bar) {
      if (s === 0) a.pad(t, chord, a.barLength * 1.1, 0.05, 1600);
      if (s === 0 || s === 8) a.bass(t, chord[0] - 12, a.stepLength * 7, 0.12, 600);
      if (s % 2 === 0) a.pluck(t, chord[(s / 2) % 4] + 12, 0.4, 0.035, 'triangle');
      if (s === 0) a.bell(t, chord[2] + 24, 0.04);
    }
  },
  gameover: {
    bpm: 60,
    chords: [[45, 52, 57, 60], [38, 50, 53, 57], [40, 52, 56, 59], [45, 52, 57, 60]],
    layers(a, s, chord, t, i, bar) {
      if (s === 0) a.pad(t, chord, a.barLength * 1.1, 0.045, 600);
      if (s === 0) a.drone(t, chord[0] - 12, a.barLength, 0.09);
      if (s === 8) a.pluck(t, chord[3] + 12, 1.2, 0.03, 'sine');
    }
  }
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.currentTrack = null;
    this.intensity = 0;
    this.loops = new Set();
    this.voiceEnabled = true;
    this._duck = 1;
    settings.onChange(() => this.applyVolumes());
  }

  // Must be called from a user gesture (browser autoplay policy).
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.setupGraph(new Ctx());
    this.applyVolumes();
    this.scheduler = setInterval(() => this.schedule(), 25);
  }



  // Builds the mixing graph on any AudioContext — including an
  // OfflineAudioContext, which the trailer uses to render its soundtrack.
  setupGraph(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.ratio.value = 4;
    this.master.connect(compressor).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);

    // Shared reverb: a convolver fed with a synthetic exponentially decaying impulse.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.6, 2.4);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);

    // Music echo.
    this.musicDelay = ctx.createDelay(1.0);
    this.musicDelayFeedback = ctx.createGain();
    this.musicDelayFeedback.gain.value = 0.32;
    this.musicDelay.connect(this.musicDelayFeedback).connect(this.musicDelay);
    this.musicDelay.connect(this.musicBus);

    this.noiseBuffer = this.makeNoise(2);
    this.ready = true;
  }

  // Offline: schedules a whole music segment [start, end) on the audio clock.
  scheduleSegment(name, start, end, intensityAt = () => 0, fadeIn = 0.05, fadeOut = 1.0) {
    const def = TRACKS[name];
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(1, start + fadeIn);
    gain.gain.setValueAtTime(1, Math.max(start + fadeIn, end - fadeOut));
    gain.gain.linearRampToValueAtTime(0.0001, end);
    gain.connect(this.musicBus);
    const send = this.ctx.createGain();
    send.gain.value = 0.25;
    gain.connect(send).connect(this.musicDelay);
    const track = { name, def, gain, stepLength: 60 / def.bpm / 4 };
    const voice = this.instrumentsFor(track);
    let step = 0, bar = 0;
    for (let t = start; t < end - 0.02; t += track.stepLength) {
      def.layers(voice, step, def.chords[bar % def.chords.length], t, intensityAt(t), bar);
      step++;
      if (step >= 16) { step = 0; bar++; }
    }
  }

  makeNoise(seconds) {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  applyVolumes() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.get('masterVolume'), now, 0.05);
    this.musicBus.gain.setTargetAtTime(settings.get('musicVolume') * 0.55 * this._duck, now, 0.2);
    this.sfxBus.gain.setTargetAtTime(settings.get('sfxVolume'), now, 0.05);
  }

  suspend() {
    this.ctx?.suspend();
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  // ------------------------------------------------------------------ music --
  playMusic(name, fade = 1.5) {
    if (!this.ready || this.currentTrack?.name === name) return;
    const now = this.ctx.currentTime;
    if (this.currentTrack) {
      const old = this.currentTrack;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + fade);
      setTimeout(() => old.gain.disconnect(), (fade + 4) * 1000);
      old.stopped = true;
    }
    const def = TRACKS[name];
    if (!def) {
      this.currentTrack = null;
      return;
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fade);
    gain.connect(this.musicBus);
    const send = this.ctx.createGain();
    send.gain.value = 0.25;
    gain.connect(send).connect(this.musicDelay);
    this.musicDelay.delayTime.setValueAtTime((60 / def.bpm) * 0.75, now);
    this.currentTrack = {
      name, def, gain, step: 0, bar: 0,
      nextTime: now + 0.1,
      stepLength: 60 / def.bpm / 4
    };
  }

  stopMusic(fade = 1) {
    this.playMusic('__none__', fade);
  }

  setIntensity(value) {
    this.intensity = Math.max(0, Math.min(1, value));
  }

  schedule() {
    const track = this.currentTrack;
    if (!track || !this.ready || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Throttled background tabs: skip forward rather than bursting old notes.
    if (track.nextTime < now - 0.05) track.nextTime = now + 0.05;
    const voice = this.instrumentsFor(track);
    while (track.nextTime < now + 0.12) {
      const chord = track.def.chords[track.bar % track.def.chords.length];
      track.def.layers(voice, track.step, chord, track.nextTime, this.intensity, track.bar);
      track.nextTime += track.stepLength;
      track.step++;
      if (track.step >= 16) {
        track.step = 0;
        track.bar++;
      }
    }
  }

  instrumentsFor(track) {
    // Cached per track so the scheduler allocates nothing in its hot loop.
    if (track.voice) return track.voice;
    const ctx = this.ctx;
    const out = track.gain;
    const engine = this;
    const env = (g, t, peak, attack, release) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    };
    track.voice = {
      stepLength: track.stepLength,
      barLength: track.stepLength * 16,
      pad(t, notes, dur, vol, cutoff) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = cutoff;
        filter.Q.value = 0.7;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
        g.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.7);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        filter.connect(g).connect(out);
        g.connect(engine.reverbSend);
        for (const n of notes) {
          for (const detune of [-7, 7]) {
            const o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = midiToFreq(n);
            o.detune.value = detune;
            o.connect(filter);
            o.start(t);
            o.stop(t + dur + 0.05);
          }
        }
      },
      drone(t, note, dur, vol) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, t);
        filter.frequency.linearRampToValueAtTime(320, t + dur * 0.5);
        filter.frequency.linearRampToValueAtTime(140, t + dur);
        filter.connect(g).connect(out);
        for (const [type, mult] of [['sawtooth', 1], ['sine', 0.5]]) {
          const o = ctx.createOscillator();
          o.type = type;
          o.frequency.value = midiToFreq(note) * mult;
          o.connect(filter);
          o.start(t);
          o.stop(t + dur + 0.05);
        }
      },
      bass(t, note, dur, vol, cutoff) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiToFreq(note);
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = midiToFreq(note - 12);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 4;
        filter.frequency.setValueAtTime(cutoff * 1.6, t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.3), t + dur);
        const g = ctx.createGain();
        env(g, t, vol, 0.008, dur);
        o.connect(filter);
        sub.connect(filter);
        filter.connect(g).connect(out);
        o.start(t); sub.start(t);
        o.stop(t + dur + 0.05); sub.stop(t + dur + 0.05);
      },
      pluck(t, note, dur, vol, type = 'triangle', cutoff = 2400) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = midiToFreq(note);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(cutoff, t);
        filter.frequency.exponentialRampToValueAtTime(300, t + dur);
        const g = ctx.createGain();
        env(g, t, vol, 0.004, dur);
        o.connect(filter).connect(g).connect(out);
        g.connect(engine.reverbSend);
        o.start(t);
        o.stop(t + dur + 0.05);
      },
      bell(t, note, vol) {
        for (const [mult, v] of [[1, 1], [2.76, 0.4], [5.4, 0.15]]) {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = midiToFreq(note) * mult;
          const g = ctx.createGain();
          env(g, t, vol * v, 0.003, 2.2 / mult);
          o.connect(g).connect(out);
          g.connect(engine.reverbSend);
          o.start(t);
          o.stop(t + 2.5);
        }
      },
      stab(t, note, vol) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1400;
        filter.Q.value = 1.2;
        const g = ctx.createGain();
        env(g, t, vol, 0.005, 0.22);
        filter.connect(g).connect(out);
        for (const d of [-12, 0, 12]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = midiToFreq(note);
          o.detune.value = d;
          o.connect(filter);
          o.start(t);
          o.stop(t + 0.3);
        }
      },
      kick(t, vol, endFreq = 45) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(160, t);
        o.frequency.exponentialRampToValueAtTime(endFreq, t + 0.12);
        const g = ctx.createGain();
        env(g, t, vol, 0.002, 0.38);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.45);
      },
      snare(t, vol) {
        const n = ctx.createBufferSource();
        n.buffer = engine.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1200;
        const g = ctx.createGain();
        env(g, t, vol, 0.002, 0.16);
        n.connect(filter).connect(g).connect(out);
        g.connect(engine.reverbSend);
        n.start(t, Math.random() * 1.5, 0.2);
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(200, t);
        o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
        const og = ctx.createGain();
        env(og, t, vol * 0.8, 0.002, 0.09);
        o.connect(og).connect(out);
        o.start(t);
        o.stop(t + 0.12);
      },
      hat(t, vol) {
        const n = ctx.createBufferSource();
        n.buffer = engine.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7500;
        const g = ctx.createGain();
        env(g, t, vol, 0.001, 0.045);
        n.connect(filter).connect(g).connect(out);
        n.start(t, Math.random() * 1.5, 0.06);
      },
      tick(t, vol) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 2600;
        const g = ctx.createGain();
        env(g, t, vol, 0.001, 0.025);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.04);
      }
    };
    return track.voice;
  }

  // -------------------------------------------------------------------- sfx --
  // Creates a destination for a one-shot: optionally spatialised via a panner.
  output(position, volume = 1, reverb = 0.2) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = volume;
    if (position) {
      const p = this.makePanner(position);
      g.connect(p).connect(this.sfxBus);
    } else {
      g.connect(this.sfxBus);
    }
    if (reverb > 0) {
      const send = ctx.createGain();
      send.gain.value = reverb;
      g.connect(send).connect(this.reverbSend);
    }
    return g;
  }

  makePanner(position) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 2;
    p.maxDistance = 60;
    p.rolloffFactor = 1.4;
    if (p.positionX) {
      p.positionX.value = position.x;
      p.positionY.value = position.y;
      p.positionZ.value = position.z;
    } else {
      p.setPosition(position.x, position.y, position.z);
    }
    return p;
  }

  tone(out, t, type, f0, f1, dur, vol, attack = 0.005) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(out, t, dur, vol, type, f0, f1 = f0, q = 1, attack = 0.005) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    n.loop = dur > 1.9;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(filter).connect(g).connect(out);
    n.start(t, n.loop ? 0 : Math.random() * Math.max(0, 1.9 - dur));
    n.stop(t + dur + 0.05);
  }

  play(name, opts = {}) {
    if (!this.ready || (opts.at === undefined && this.ctx.state !== 'running')) return;
    const t = opts.at ?? this.ctx.currentTime + 0.005;
    const v = opts.volume ?? 1;
    const p = opts.pitch ?? 1;
    const out = this.output(opts.position, v, opts.reverb ?? 0.2);
    switch (name) {
      case 'step':
        this.noise(out, t, 0.06, 0.12, 'bandpass', 900 * p, 500 * p, 2);
        this.tone(out, t, 'square', 120 * p, 90 * p, 0.04, 0.03);
        break;
      case 'servo':
        this.tone(out, t, 'sawtooth', 300 * p, 420 * p, 0.15, 0.03);
        break;
      case 'jump':
        this.noise(out, t, 0.35, 0.25, 'bandpass', 500, 2500, 1.5);
        this.tone(out, t, 'triangle', 220, 520, 0.2, 0.08);
        break;
      case 'boost':
        this.noise(out, t, 0.5, 0.35, 'bandpass', 300, 3000, 1.2);
        this.tone(out, t, 'sawtooth', 150, 600, 0.3, 0.08);
        break;
      case 'land':
        this.tone(out, t, 'sine', 140, 50, 0.18, 0.35 * v);
        this.noise(out, t, 0.12, 0.15, 'lowpass', 900, 200);
        break;
      case 'pickup':
        [0, 0.07, 0.14].forEach((d, i) => this.tone(out, t + d, 'triangle', [880, 1320, 1760][i], [880, 1320, 1760][i], 0.25, 0.12));
        break;
      case 'keycard':
        [0, 0.09, 0.18, 0.27].forEach((d, i) => this.tone(out, t + d, 'square', [523, 659, 784, 1047][i], [523, 659, 784, 1047][i], 0.3, 0.06));
        this.tone(out, t + 0.27, 'sine', 2093, 2093, 0.8, 0.05);
        break;
      case 'log':
        this.tone(out, t, 'sine', 1200, 1200, 0.08, 0.08);
        this.tone(out, t + 0.1, 'sine', 1600, 1600, 0.12, 0.08);
        break;
      case 'door':
        this.tone(out, t, 'sawtooth', 70, 110, 1.4, 0.12, 0.1);
        this.noise(out, t, 1.5, 0.25, 'bandpass', 400, 1600, 0.8, 0.1);
        this.noise(out, t + 1.3, 0.3, 0.3, 'lowpass', 600, 120);
        break;
      case 'locked':
        this.tone(out, t, 'square', 140, 140, 0.15, 0.08);
        this.tone(out, t + 0.18, 'square', 110, 110, 0.22, 0.08);
        break;
      case 'steam':
        this.noise(out, t, 1.3, 0.55, 'highpass', 1500, 3500, 0.6, 0.03);
        this.noise(out, t, 1.0, 0.3, 'bandpass', 600, 300, 0.8);
        break;
      case 'steamWarn':
        this.noise(out, t, 0.7, 0.15, 'bandpass', 3000, 5000, 4);
        break;
      case 'damage':
        this.tone(out, t, 'sawtooth', 700, 80, 0.35, 0.22);
        this.noise(out, t, 0.25, 0.35, 'bandpass', 2000, 400, 1);
        break;
      case 'zap':
        for (let k = 0; k < 6; k++) this.tone(out, t + k * 0.03, 'square', 1800 - k * 200, 300, 0.05, 0.1);
        this.noise(out, t, 0.3, 0.3, 'highpass', 3000, 6000, 1);
        break;
      case 'alarm':
        for (let k = 0; k < 3; k++) {
          this.tone(out, t + k * 0.5, 'square', 880, 880, 0.22, 0.09);
          this.tone(out, t + k * 0.5 + 0.25, 'square', 620, 620, 0.22, 0.09);
        }
        break;
      case 'success':
        this.tone(out, t, 'sine', 660, 660, 0.18, 0.15);
        this.tone(out, t + 0.12, 'sine', 990, 990, 0.35, 0.15);
        break;
      case 'error':
        this.tone(out, t, 'sawtooth', 160, 120, 0.4, 0.15);
        this.tone(out, t, 'square', 166, 126, 0.4, 0.08);
        break;
      case 'surge':
        this.tone(out, t, 'sawtooth', 60, 900, 0.5, 0.2);
        this.noise(out, t + 0.4, 0.6, 0.5, 'bandpass', 3000, 200, 0.7);
        break;
      case 'beep':
        this.tone(out, t, 'square', 1400 * p, 1400 * p, 0.07, 0.06);
        break;
      case 'type':
        this.tone(out, t, 'square', 1800 + Math.random() * 400, 1800, 0.02, 0.025);
        break;
      case 'ui':
        this.tone(out, t, 'triangle', 1000 * p, 1400 * p, 0.06, 0.06);
        break;
      case 'uiHover':
        this.tone(out, t, 'sine', 1800, 1800, 0.03, 0.025);
        break;
      case 'scan':
        this.tone(out, t, 'sine', 1400, 300, 1.2, 0.12, 0.01);
        this.tone(out, t, 'sine', 1410, 305, 1.2, 0.08, 0.01);
        break;
      case 'flashlight':
        this.tone(out, t, 'square', 2400, 2400, 0.02, 0.06);
        this.noise(out, t, 0.04, 0.1, 'highpass', 4000);
        break;
      case 'crash':
        this.tone(out, t, 'sine', 90, 30, 0.8, 0.5);
        this.noise(out, t, 1.0, 0.6, 'lowpass', 2000, 120, 0.6);
        this.noise(out, t + 0.05, 0.4, 0.3, 'bandpass', 3000, 800, 1);
        break;
      case 'rumble':
        this.noise(out, t, 2.0, 0.4, 'lowpass', 220, 60, 0.6, 0.3);
        this.tone(out, t, 'sine', 45, 30, 2.0, 0.25, 0.3);
        break;
      case 'junction':
        this.tone(out, t, 'sawtooth', 100, 400, 0.6, 0.12, 0.02);
        this.tone(out, t + 0.5, 'sine', 800, 800, 0.4, 0.1);
        break;
      case 'tile':
        this.tone(out, t, 'triangle', 600 * p, 750 * p, 0.08, 0.08);
        break;
      case 'countdown':
        this.tone(out, t, 'square', 1100, 1100, 0.1, 0.07);
        break;
      case 'lava':
        this.noise(out, t, 0.6, 0.4, 'lowpass', 900, 200, 1);
        this.tone(out, t, 'sine', 200, 60, 0.4, 0.3);
        break;
      case 'piston':
        this.tone(out, t, 'sine', 120, 40, 0.3, 0.45);
        this.noise(out, t, 0.25, 0.5, 'lowpass', 1500, 200);
        break;
      case 'seal':
        this.tone(out, t, 'sawtooth', 80, 1600, 3.0, 0.15, 0.5);
        this.tone(out, t, 'sine', 160, 3200, 3.0, 0.1, 0.5);
        this.noise(out, t + 2.8, 2.5, 0.4, 'lowpass', 3000, 100, 0.5, 0.05);
        break;
      case 'reboot':
        this.tone(out, t, 'sawtooth', 50, 400, 1.2, 0.12, 0.2);
        [0.9, 1.05, 1.2].forEach((d, i) => this.tone(out, t + d, 'sine', [440, 660, 880][i], [440, 660, 880][i], 0.15, 0.1));
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------ loops --
  // Long-running positional sounds (steam vents, the reactor hum, fire wall).
  createLoop(kind, position) {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const panner = position ? this.makePanner(position) : null;
    if (panner) gain.connect(panner).connect(this.sfxBus);
    else gain.connect(this.sfxBus);
    const nodes = [];

    const noiseSource = (type, freq, q) => {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      n.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      n.connect(f).connect(gain);
      n.start(ctx.currentTime, Math.random() * 1.5);
      nodes.push(n);
      return f;
    };
    const osc = (type, freq, vol) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g).connect(gain);
      o.start();
      nodes.push(o);
      return o;
    };

    let filter = null;
    if (kind === 'hiss') filter = noiseSource('highpass', 2500, 0.5);
    if (kind === 'fire') {
      filter = noiseSource('lowpass', 500, 0.8);
      osc('sine', 38, 0.6);
    }
    if (kind === 'thruster') filter = noiseSource('bandpass', 1200, 0.9);
    if (kind === 'hum') {
      osc('sine', 55, 0.5);
      osc('sawtooth', 110.5, 0.08);
      const lfo = osc('sine', 0.4, 0);
      lfo.disconnect();
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 6;
      lfo.connect(lfoGain);
      filter = noiseSource('bandpass', 180, 2);
      lfoGain.connect(filter.frequency);
    }
    if (kind === 'wind') filter = noiseSource('bandpass', 300, 0.4);

    const handle = {
      gain,
      filter,
      setVolume: (v, ramp = 0.1) => {
        gain.gain.setTargetAtTime(v, ctx.currentTime, ramp);
      },
      setPosition: (p) => {
        if (!panner) return;
        if (panner.positionX) {
          panner.positionX.value = p.x;
          panner.positionY.value = p.y;
          panner.positionZ.value = p.z;
        } else {
          panner.setPosition(p.x, p.y, p.z);
        }
      },
      stop: () => {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        setTimeout(() => {
          for (const n of nodes) {
            try { n.stop(); } catch { /* already stopped */ }
          }
          gain.disconnect();
        }, 600);
        this.loops.delete(handle);
      }
    };
    this.loops.add(handle);
    return handle;
  }

  stopAllLoops() {
    for (const loop of [...this.loops]) loop.stop();
  }

  updateListener(camera) {
    if (!this.ready) return;
    const l = this.ctx.listener;
    const m = camera.matrixWorld.elements;
    const px = m[12], py = m[13], pz = m[14];
    const fx = -m[8], fy = -m[9], fz = -m[10];
    const ux = m[4], uy = m[5], uz = m[6];
    if (l.positionX) {
      l.positionX.value = px; l.positionY.value = py; l.positionZ.value = pz;
      l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
      l.upX.value = ux; l.upY.value = uy; l.upZ.value = uz;
    } else {
      l.setPosition(px, py, pz);
      l.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  // ------------------------------------------------------------------ voice --
  // ARIA, the station AI, is voiced with the Web Speech API when enabled.
  say(text) {
    if (!settings.get('voice') || !('speechSynthesis' in window)) return;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      const preferred = voices.find((v) => /Google UK English Female/i.test(v.name))
        || voices.find((v) => /female|zira|samantha|serena/i.test(v.name) && /en/i.test(v.lang))
        || voices.find((v) => /^en/i.test(v.lang));
      if (preferred) u.voice = preferred;
      u.rate = 1.04;
      u.pitch = 0.85;
      u.volume = Math.min(1, settings.get('masterVolume') * 1.1);
      u.onstart = () => { this._duck = 0.55; this.applyVolumes(); };
      u.onend = () => { this._duck = 1; this.applyVolumes(); };
      synth.speak(u);
    } catch {
      /* speech is optional */
    }
  }

  silenceVoice() {
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    this._duck = 1;
    this.applyVolumes();
  }
}

export const audio = new AudioEngine();
