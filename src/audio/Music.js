import { Sfx } from './Sfx.js';

// Music for the hall, synthesised like everything else: a bourdon drone (as on a
// hurdy-gurdy), a plucked harp improvising in D Dorian, and a tabor that drives
// harder as the fight does. `intensity` 0..1 sets the arrangement; moods change
// it smoothly. A small look-ahead scheduler keeps time.

const D = 146.83;                      // D3
const DORIAN = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17];
const MOTIFS = [
  [0, 2, 4, 2, 1, 0], [4, 5, 4, 2, 3, 1], [7, 6, 4, 5, 4, 2], [0, 4, 7, 6, 4, 2],
  [2, 1, 0, -1, 0, 2], [4, 4, 5, 7, 5, 4], [9, 7, 6, 4, 2, 4], [0, 0, 2, 4, 3, 2],
];
// The menus' music: "Wendale Abbey", plainsong by Yubatake (CC-BY 4.0, OpenGameArt.org),
// looped quietly. Fetched the first time it's wanted.
const CHANT_URL = new URL('../../assets/audio/wendale-abbey.mp3', import.meta.url).href;
const CHANT_LEVEL = 0.5;

const semis = (i) => DORIAN[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);

class MusicEngine {
  constructor() {
    this.on = true;
    this.mood = null;
    this.intensity = 0;
    this.target = 0;
    this.bpm = 84;
    this.timer = null;
  }

  _ready() {
    const s = Sfx;
    if (!s.ctx || s.ctx.state !== 'running') return false;
    if (!this.out) {
      this.out = s.ctx.createGain();
      this.out.gain.value = 0;
      this.out.connect(s.master);
      this.nextBeat = s.ctx.currentTime + 0.1;
      this.beat = 0;
      this.motif = MOTIFS[0];
    }
    return true;
  }

  setEnabled(on) {
    this.on = on;
    if (!on) { this._fadeTo(0, 0.4); this._chant(false); }
    else if (this.mood) this.play(this.mood, true);
  }

  // Fade the chant in (looping) or out. Waits for the audio to be unlocked by a tap or key.
  _chant(want) {
    this.chantWanted = want && this.on;
    if (!this._ready()) return;
    const ctx = Sfx.ctx;
    if (!this.chantGain) {
      this.chantGain = ctx.createGain();
      this.chantGain.gain.value = 0;
      this.chantGain.connect(Sfx.master);
    }
    const g = this.chantGain.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.chantWanted ? CHANT_LEVEL : 0, t + (this.chantWanted ? 2.5 : 1.0));
    if (!this.chantWanted || this.chantSrc) return;
    if (!this.chantBuf) {
      if (this.chantLoading) return;
      this.chantLoading = fetch(CHANT_URL).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b))
        .then((buf) => { this.chantBuf = buf; this.chantLoading = null; this._chant(this.mood === 'abbey'); })
        .catch(() => { this.chantLoading = null; });
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.chantBuf;
    src.loop = true;
    src.connect(this.chantGain);
    src.start();
    this.chantSrc = src;
  }

  // abbey (the menus' chant) | camp | duel | stand (last stand / blade lock) | victory | silence
  play(mood, force = false) {
    if (this.mood === mood && !force) return;
    this.mood = mood;
    this.target = { camp: 0.15, duel: 0.55, stand: 1, victory: 0.4, silence: 0, abbey: 0 }[mood] ?? 0.5;
    if (!this.timer) this.timer = setInterval(() => this._tick(), 90);
    if (this._ready()) this._fadeTo(this.on && mood !== 'silence' && mood !== 'abbey' ? (mood === 'camp' ? 0.5 : 0.62) : 0, 1.2);
    this._chant(mood === 'abbey');
    if (mood === 'victory' && this._ready() && this.on) this._fanfare();
  }

  _fadeTo(v, s) {
    if (!this.out) return;
    const g = this.out.gain;
    const t = Sfx.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(v, t + s);
  }

  _tick() {
    if (!this._ready()) return;
    // The chant waits for the audio to be unlocked; start it once it is.
    if (this.mood === 'abbey' && this.on && !this.chantSrc && !this.chantLoading) this._chant(true);
    if (this.out.gain.value === 0 && this.mood && this.on && this.mood !== 'silence' && this.mood !== 'abbey') this._fadeTo(this.mood === 'camp' ? 0.5 : 0.62, 1.2);
    this.intensity += (this.target - this.intensity) * 0.08;
    const ctx = Sfx.ctx;
    const bpm = this.bpm + this.intensity * 26;
    const spb = 60 / bpm / 2;                    // eighth notes
    while (this.nextBeat < ctx.currentTime + 0.3) {
      this._schedule(this.nextBeat, this.beat);
      this.nextBeat += spb;
      this.beat += 1;
    }
  }

  _schedule(t, n) {
    const I = this.intensity;
    const bar = n % 16;
    // Drone: renewed every two bars.
    if (n % 32 === 0) {
      this._drone(t, D / 2, 60 / (this.bpm + I * 26) * 8.2);
      this._drone(t, D * 0.75, 60 / (this.bpm + I * 26) * 8.2, 0.5);
    }
    // Harp: a motif per bar, varied; denser as the fight heats up.
    if (bar === 0) this.motif = MOTIFS[(Math.random() * MOTIFS.length) | 0];
    const step = bar % 8;
    const play = I < 0.3 ? step % 2 === 0 : I < 0.8 ? step !== 7 : true;
    if (play && this.mood !== 'silence') {
      const deg = this.motif[Math.min(this.motif.length - 1, Math.floor(step * this.motif.length / 8))] + (bar >= 8 ? 2 : 0);
      this._pluck(t, D * 2 ** (semis(deg) / 12), 0.11 + I * 0.04);
      if (I > 0.6 && step % 4 === 0) this._pluck(t, D * 2 ** ((semis(deg) - 12) / 12), 0.07);
    }
    // Tabor: from a heartbeat to a war-march.
    if (I > 0.2) {
      if (step === 0 || step === 4) this._drum(t, 1);
      if (I > 0.45 && (step === 3 || step === 7)) this._drum(t, 0.55);
      if (I > 0.8 && step % 2 === 1) this._drum(t, 0.35, true);
    }
  }

  _drone(t, f, dur, level = 1) {
    const ctx = Sfx.ctx;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700 + this.intensity * 500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045 * level, t + 0.6);
    g.gain.setValueAtTime(0.045 * level, t + dur - 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    [-6, 5].forEach((dt) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = dt;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
    lp.connect(g);
    g.connect(this.out);
  }

  // A plucked string: bright attack through a closing filter.
  _pluck(t, f, level) {
    const ctx = Sfx.ctx;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'triangle';
    o2.type = 'sawtooth';
    o.frequency.value = f;
    o2.frequency.value = f * 2.001;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 8, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o.connect(lp);
    o2.connect(g2);
    g2.connect(lp);
    lp.connect(g);
    g.connect(this.out);
    o.start(t);
    o2.start(t);
    o.stop(t + 0.95);
    o2.stop(t + 0.95);
  }

  _drum(t, level, rim = false) {
    const ctx = Sfx.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(rim ? 220 : 110, t);
    o.frequency.exponentialRampToValueAtTime(rim ? 160 : 52, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * level, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (rim ? 0.09 : 0.32));
    o.connect(g);
    g.connect(this.out);
    o.start(t);
    o.stop(t + 0.4);
    // The skin: a burst of filtered noise.
    const n = ctx.createBufferSource();
    n.buffer = Sfx.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rim ? 2400 : 900;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.12 * level, t + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(this.out);
    n.start(t, Math.random());
    n.stop(t + 0.1);
  }

  // Victory: a rising horn call over the drone.
  _fanfare() {
    const ctx = Sfx.ctx;
    const t0 = ctx.currentTime + 0.05;
    [[0, 0.22], [7, 0.22], [12, 0.44], [10, 0.22], [12, 0.9]].reduce((t, [s, d]) => {
      [1, 1.5].forEach((m, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.value = D * 2 ** (s / 12) * m;
        lp.type = 'lowpass';
        lp.frequency.value = 1600;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(i ? 0.03 : 0.07, t + 0.04);
        g.gain.setValueAtTime(i ? 0.03 : 0.07, t + d * 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25);
        o.connect(lp);
        lp.connect(g);
        g.connect(this.out);
        o.start(t);
        o.stop(t + d + 0.3);
      });
      return t + d;
    }, t0);
  }
}

export const Music = new MusicEngine();
