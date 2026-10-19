// All sounds are synthesised with the Web Audio API. No audio files.

class SfxEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.75;
  }

  // Must be called from inside a user gesture (first tap) to satisfy browsers.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.noiseBuf = this._makeNoise();
      // iOS needs a sound started inside the gesture to fully unlock.
      const b = this.ctx.createBufferSource();
      b.buffer = this.ctx.createBuffer(1, 1, 22050);
      b.connect(this.master);
      b.start(0);
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  _ok() {
    return this.ctx && !this.muted && this.ctx.state === 'running';
  }

  _makeNoise() {
    const len = this.ctx.sampleRate * 1.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _env(gainNode, t, attack, peak, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone(freq, decay, { type = 'sine', gain = 0.3, attack = 0.003, freqEnd = null, delay = 0, detune = 0 } = {}) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.value = detune;
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay);
    this._env(g, t, attack, gain, decay);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  noise(decay, { gain = 0.3, attack = 0.003, filter = 'bandpass', freq = 1000, freqEnd = null, q = 1, delay = 0 } = {}) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;   // long swells (the crowd) outlast the 1.5 s buffer
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay);
    f.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t, attack, gain, decay);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + attack + decay + 0.05);
  }

  // Bright, long steel ring: the signature parry sound. Inharmonic partials (as a
  // struck blade has), a hard transient and a body thud so it lands with weight.
  parry() {
    const k = 0.97 + Math.random() * 0.06;
    [1320, 2093, 2960, 4180, 5600, 7310].forEach((f, i) => {
      this.tone(f * k * (0.99 + Math.random() * 0.02), 1.1 - i * 0.14, { gain: 0.15 - i * 0.02, type: 'sine' });
    });
    this.tone(660 * k, 0.6, { gain: 0.12, type: 'triangle' });
    this.tone(150, 0.22, { gain: 0.35, freqEnd: 70, type: 'sine' });
    this.noise(0.06, { gain: 0.45, filter: 'highpass', freq: 2600 });
  }

  // Your blow turned aside by the enemy: a short, heavy knock of steel on steel.
  clang() {
    const k = 0.92 + Math.random() * 0.16;
    [740, 1180, 1710, 2630].forEach((f, i) => this.tone(f * k, 0.22 - i * 0.04, { gain: 0.08, type: i ? 'sine' : 'square' }));
    this.tone(120, 0.12, { gain: 0.25, freqEnd: 70 });
    this.noise(0.05, { gain: 0.25, filter: 'bandpass', freq: 2200, q: 2 });
  }

  // The crowd: a murmur under everything, and its reactions.
  crowd(on) {
    if (!this.ctx) return;
    if (on && !this.crowdNode) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 480;
      bp.Q.value = 0.6;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.035, this.ctx.currentTime + 1.5);
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.frequency.value = 0.13;
      lg.gain.value = 0.012;
      lfo.connect(lg);
      lg.connect(g.gain);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start();
      lfo.start();
      this.crowdNode = { src, lfo, g };
    } else if (!on && this.crowdNode) {
      const { src, lfo, g } = this.crowdNode;
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.6);
      src.stop(t + 0.7);
      lfo.stop(t + 0.7);
      this.crowdNode = null;
    }
  }

  gasp() {
    this.noise(0.5, { gain: 0.14, attack: 0.04, filter: 'bandpass', freq: 1100, freqEnd: 420, q: 0.7 });
  }

  cheer() {
    this.noise(1.0, { gain: 0.14, attack: 0.12, filter: 'bandpass', freq: 600, freqEnd: 850, q: 0.6 });
    this.noise(0.8, { gain: 0.08, attack: 0.2, filter: 'bandpass', freq: 1400, q: 0.9, delay: 0.05 });
  }

  // Low health: your own heart.
  heartbeat() {
    this.tone(55, 0.16, { gain: 0.5, freqEnd: 40 });
    this.tone(52, 0.2, { gain: 0.38, freqEnd: 38, delay: 0.22 });
  }

  // Dull wooden thud on the shield.
  block() {
    this.tone(150, 0.16, { gain: 0.55, freqEnd: 60, type: 'sine' });
    this.noise(0.1, { gain: 0.45, filter: 'lowpass', freq: 900, q: 0.7 });
    this.tone(320, 0.06, { gain: 0.15, type: 'triangle' });
  }

  shieldBreak() {
    this.noise(0.35, { gain: 0.5, filter: 'lowpass', freq: 1400, freqEnd: 200 });
    this.tone(110, 0.3, { gain: 0.4, freqEnd: 50, type: 'sawtooth' });
  }

  swipe() {
    this.noise(0.14, { gain: 0.22, attack: 0.02, filter: 'bandpass', freq: 600, freqEnd: 2600, q: 1.4 });
  }

  dodge() {
    this.noise(0.22, { gain: 0.25, attack: 0.04, filter: 'bandpass', freq: 380, freqEnd: 900, q: 0.9 });
  }

  // You strike flesh/mail.
  hit() {
    this.noise(0.12, { gain: 0.6, filter: 'bandpass', freq: 1500, freqEnd: 500, q: 0.8 });
    this.tone(180, 0.12, { gain: 0.35, freqEnd: 90, type: 'triangle' });
  }

  // You take a blow: low thump.
  hurt() {
    this.tone(85, 0.28, { gain: 0.8, freqEnd: 38, type: 'sine' });
    this.noise(0.16, { gain: 0.4, filter: 'lowpass', freq: 500 });
  }

  glint(red) {
    if (red) {
      this.tone(98, 0.45, { gain: 0.22, type: 'sawtooth', attack: 0.06 });
      this.tone(147, 0.45, { gain: 0.12, type: 'sawtooth', attack: 0.06 });
    } else {
      this.tone(2637, 0.22, { gain: 0.08 });
      this.tone(3951, 0.15, { gain: 0.05, delay: 0.02 });
    }
  }

  windowOpen() {
    this.tone(3520, 0.08, { gain: 0.05 });
  }

  stagger() {
    this.tone(70, 0.6, { gain: 0.6, freqEnd: 40, type: 'sine' });
    this.tone(523, 0.5, { gain: 0.08, type: 'triangle' });
    this.tone(784, 0.5, { gain: 0.06, type: 'triangle', delay: 0.06 });
  }

  combo() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { gain: 0.1, type: 'triangle', delay: i * 0.05 }));
  }

  superBurst() {
    this.noise(0.6, { gain: 0.4, filter: 'bandpass', freq: 300, freqEnd: 4000, q: 0.8 });
    [392, 523, 659, 784].forEach((f) => this.tone(f, 1.0, { gain: 0.09, type: 'triangle' }));
  }

  bell() {
    const base = 196;
    [0.5, 1, 1.19, 1.5, 2, 2.52, 3.01, 4.1].forEach((m, i) => {
      this.tone(base * m, 3.2 - i * 0.3, { gain: 0.14 / (1 + i * 0.4), attack: 0.004 });
    });
  }

  defeat() {
    this.tone(110, 1.6, { gain: 0.3, type: 'sawtooth', freqEnd: 55, attack: 0.05 });
    this.tone(82, 1.8, { gain: 0.3, type: 'sine', attack: 0.05 });
  }

  click() {
    this.tone(1200, 0.04, { gain: 0.08, type: 'triangle' });
  }

  // His blade leaving the wind-up: an audible 'now'.
  whoosh(heavy = false) {
    this.noise(heavy ? 0.26 : 0.18, { gain: heavy ? 0.3 : 0.22, attack: 0.03, filter: 'bandpass', freq: heavy ? 260 : 420, freqEnd: heavy ? 900 : 1500, q: 1.4 });
  }

  // The crowd in the galleries: a swelling roar.
  roar() {
    this.noise(2.6, { gain: 0.22, attack: 0.35, filter: 'bandpass', freq: 520, freqEnd: 700, q: 0.6 });
    this.noise(2.2, { gain: 0.14, attack: 0.5, filter: 'bandpass', freq: 1200, freqEnd: 1500, q: 0.8, delay: 0.15 });
    [0.3, 0.55, 0.9, 1.2].forEach((d, i) => this.tone(520 + i * 90, 0.25, { gain: 0.04, type: 'triangle', freqEnd: 700 + i * 80, delay: d }));
  }

  laugh() {
    [0, 0.18, 0.36].forEach((d) => this.tone(120, 0.14, { gain: 0.3, type: 'sawtooth', freqEnd: 90, delay: d }));
  }
}

export const Sfx = new SfxEngine();
