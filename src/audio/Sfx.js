// Sounds: recorded clips throughout (credits in assets/audio/sfx/CREDITS.txt and the Book of
// Arms). Each falls back to Web Audio synthesis if its clips haven't loaded.

const CLIPS = {
  bell: ['bell'],
  block_shield: ['block_shield_1', 'block_shield_2', 'block_shield_3'],
  book_close: ['book_close'],
  book_flip: ['book_flip'],
  book_open: ['book_open'],
  cheer: ['cheer_1', 'cheer_2', 'cheer_3'],
  chime: ['chime_1', 'chime_2'],
  clash: ['clash_1', 'clash_2', 'clash_3', 'clash_4'],
  clash_heavy: ['clash_heavy_1', 'clash_heavy_2'],
  clatter: ['clatter_1', 'clatter_2'],
  click: ['click'],
  cloth: ['cloth_1', 'cloth_2', 'cloth_3'],
  crowd_loop: ['crowd_loop'],
  cry: ['cry_1', 'cry_2', 'cry_3', 'cry_4', 'cry_5', 'cry_6', 'cry_7'],
  cry_heavy: ['cry_heavy_1', 'cry_heavy_2', 'cry_heavy_3', 'cry_heavy_4', 'cry_heavy_5'],
  death: ['death_1', 'death_2', 'death_3'],
  dodge: ['dodge_1', 'dodge_2'],
  draw: ['draw_1', 'draw_2', 'draw_3', 'draw_4'],
  gasp: ['gasp'],
  grunt: ['grunt_1', 'grunt_2', 'grunt_3', 'grunt_4', 'grunt_5'],
  heartbeat: ['heartbeat'],
  hit_leather: ['hit_leather_1', 'hit_leather_2', 'hit_leather_3'],
  hit_mail: ['hit_mail_1', 'hit_mail_2', 'hit_mail_3'],
  hit_plate: ['hit_plate_1', 'hit_plate_2', 'hit_plate_3'],
  jeer: ['jeer_1', 'jeer_2'],
  laugh: ['laugh'],
  pain: ['pain_1', 'pain_2', 'pain_3', 'pain_4', 'pain_5', 'pain_6'],
  roar: ['roar'],
  scrape: ['scrape_1', 'scrape_2', 'scrape_3'],
  shield_break: ['shield_break_1'],
  step: ['step_1', 'step_2', 'step_3', 'step_4', 'step_5'],
  swing: ['swing_1', 'swing_2', 'swing_3', 'swing_4', 'swing_5'],
  whoosh: ['whoosh_1', 'whoosh_2'],
  whoosh_heavy: ['whoosh_heavy_1', 'whoosh_heavy_2'],
};
// decodeAudioData in its callback form: older Safari (iOS 14.4 and earlier) has no promise form.
export function decodeAudio(ctx, bytes) {
  return new Promise((resolve, reject) => {
    try {
      const p = ctx.decodeAudioData(bytes, resolve, reject);
      if (p && p.catch) p.catch(reject);
    } catch (e) { reject(e); }
  });
}
const clipUrl = (n) => new URL(`../../assets/audio/sfx/${n}.mp3`, import.meta.url).href;
// Fetch the clips as soon as the page loads; they're decoded the moment the audio is unlocked.
const clipBytes = {};
if (typeof fetch !== 'undefined') {
  for (const files of Object.values(CLIPS)) {
    files.forEach((f) => { clipBytes[f] = fetch(clipUrl(f)).then((r) => r.arrayBuffer()).catch(() => null); });
  }
}

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
    if (!this.clipStats) this._loadClips();
    // Anything that must start inside the first tap (the music's audio elements).
    (this.onUnlock || []).forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    if (this.ctx.state !== 'running') {
      try {
        const p = this.ctx.resume();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* older Safari: resume() returns nothing */ }
    }
  }

  // Fetch and decode the clips once the audio is unlocked (about 175 KB in all).
  _loadClips() {
    this.clips = {};
    this.clipStats = { ok: 0, failed: 0, total: Object.values(CLIPS).reduce((n, f) => n + f.length, 0), error: '' };
    for (const [group, files] of Object.entries(CLIPS)) {
      this.clips[group] = [];
      files.forEach((f) => {
        (clipBytes[f] || fetch(clipUrl(f)).then((r) => r.arrayBuffer()))
          .then((b) => (b ? decodeAudio(this.ctx, b.slice(0)) : null))
          .then((buf) => { if (buf) { this.clips[group].push(buf); this.clipStats.ok += 1; } else this.clipStats.failed += 1; })
          .catch((e) => { this.clipStats.failed += 1; this.clipStats.error = String((e && e.message) || e || 'decode failed'); });
      });
    }
  }

  // Play a random clip from a group, with a little variation in pitch and level so repeats
  // don't sound identical. Returns false if none is loaded yet (the caller then synthesises).
  clip(group, { gain = 0.8, rate = 1, vary = 0.06, delay = 0, lowpass = 0 } = {}) {
    if (!this._ok() || !this.clips || !this.clips[group] || !this.clips[group].length) return false;
    const list = this.clips[group];
    const src = this.ctx.createBufferSource();
    src.buffer = list[(Math.random() * list.length) | 0];
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * vary);
    const g = this.ctx.createGain();
    g.gain.value = gain * (1 + (Math.random() * 2 - 1) * vary);
    if (lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f);
      f.connect(g);
    } else src.connect(g);
    g.connect(this.master);
    src.start(this.ctx.currentTime + delay);
    return true;
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
    // Recorded blade on blade, with a body thud under it for weight.
    if (this.clip('clash', { gain: 1 })) { this.tone(150, 0.22, { gain: 0.18, freqEnd: 70, type: 'sine' }); return; }
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
    if (this.clip('clash', { gain: 0.65, rate: 1.12 })) return;
    const k = 0.92 + Math.random() * 0.16;
    [740, 1180, 1710, 2630].forEach((f, i) => this.tone(f * k, 0.22 - i * 0.04, { gain: 0.08, type: i ? 'sine' : 'square' }));
    this.tone(120, 0.12, { gain: 0.25, freqEnd: 70 });
    this.noise(0.05, { gain: 0.25, filter: 'bandpass', freq: 2200, q: 2 });
  }

  // The crowd: a murmur under everything, and its reactions.
  crowd(on) {
    if (!this.ctx) return;
    if (this._crowdClip(on)) return;
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

  // A voice by formant synthesis: a buzzing glottal source shaped by the vowel's
  // resonances. v = { f0, vowel, muffle }, kind = cry | heavy | pain | stagger.
  voice(v, kind = 'cry') {
    if (!this._ok() || !v) return;
    // Recorded voices, pitched for each foe (from his synthesised f0) and muffled by a great helm.
    const group = { cry: 'cry', heavy: 'cry_heavy', pain: 'pain', stagger: 'grunt' }[kind] || 'cry';
    const rate = Math.max(0.68, Math.min(1.12, v.f0 / 118));
    if (this.clip(group, { gain: kind === 'heavy' ? 0.85 : 0.7, rate, vary: 0.04, lowpass: v.muffle ? 1400 : 0 })) return;
    const VOW = { a: [730, 1090, 2440], o: [500, 860, 2400], e: [600, 1750, 2600], u: [350, 750, 2300], ae: [660, 1720, 2410] };
    const F = VOW[v.vowel] || VOW.a;
    const len = { cry: 0.26, heavy: 0.42, pain: 0.2, stagger: 0.5 }[kind] || 0.3;
    const loud = { cry: 0.22, heavy: 0.32, pain: 0.2, stagger: 0.26 }[kind] || 0.2;
    const f0 = v.f0 * (kind === 'pain' ? 1.25 : kind === 'stagger' ? 1.1 : 1) * (0.96 + Math.random() * 0.08);
    const t = this.ctx.currentTime;
    const src = this.ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(f0 * (kind === 'heavy' ? 0.9 : 1), t);
    src.frequency.linearRampToValueAtTime(f0 * (kind === 'stagger' ? 0.6 : kind === 'heavy' ? 1.1 : 0.85), t + len);
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(loud, t + 0.03);
    out.gain.setValueAtTime(loud, t + len * 0.5);
    out.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const tail = this.ctx.createBiquadFilter();
    tail.type = 'lowpass';
    tail.frequency.value = v.muffle ? 1100 : 3600;
    F.forEach((fr, i) => {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fr;
      bp.Q.value = 6 + i * 2;
      const g = this.ctx.createGain();
      g.gain.value = [1, 0.6, 0.25][i];
      src.connect(bp);
      bp.connect(g);
      g.connect(tail);
    });
    tail.connect(out);
    out.connect(this.master);
    src.start(t);
    src.stop(t + len + 0.05);
    // Breath on the front of the shout.
    this.noise(0.08, { gain: loud * 0.4, filter: 'bandpass', freq: F[1], q: 1 });
  }

  // What a cut lands on: plate rings, mail chinks, leather thuds.
  hitArmour(kind) {
    const group = kind === 'plate' ? 'hit_plate' : kind === 'mail' ? 'hit_mail' : 'hit_leather';
    if (this.clip(group, { gain: 1 })) { this.tone(110, 0.16, { gain: 0.2, freqEnd: 55 }); return; }
    if (kind === 'plate') {
      const k = 0.9 + Math.random() * 0.2;
      [880, 1390, 2210, 3170].forEach((f, i) => this.tone(f * k, 0.35 - i * 0.06, { gain: 0.09 - i * 0.015 }));
      this.tone(140, 0.14, { gain: 0.4, freqEnd: 70 });
      this.noise(0.06, { gain: 0.35, filter: 'highpass', freq: 2500 });
    } else if (kind === 'mail') {
      for (let i = 0; i < 6; i++) this.noise(0.03, { gain: 0.18, filter: 'highpass', freq: 3000 + Math.random() * 3000, delay: i * 0.012 + Math.random() * 0.01 });
      this.tone(160, 0.12, { gain: 0.35, freqEnd: 80 });
    } else {
      this.noise(0.14, { gain: 0.5, filter: 'lowpass', freq: 700 });
      this.tone(120, 0.16, { gain: 0.45, freqEnd: 60 });
    }
  }

  step(heavy = false) {
    if (this.clip('step', { gain: heavy ? 1 : 0.75, rate: heavy ? 0.85 : 1 })) return;
    this.tone(heavy ? 60 : 75, heavy ? 0.18 : 0.12, { gain: heavy ? 0.4 : 0.25, freqEnd: 40 });
    this.noise(0.06, { gain: heavy ? 0.2 : 0.12, filter: 'lowpass', freq: 500 });
  }

  scuff() {
    if (this.clip('cloth', { gain: 0.6, rate: 1.15 })) return;
    this.noise(0.18, { gain: 0.14, attack: 0.02, filter: 'bandpass', freq: 1800, freqEnd: 900, q: 0.8 });
  }

  // The galleries jeer a gloating foe.
  jeer() {
    if (this.clip('jeer', { gain: 0.55 })) return;
    this.noise(0.9, { gain: 0.12, attack: 0.1, filter: 'bandpass', freq: 300, freqEnd: 220, q: 0.8 });
    [0, 0.25].forEach((d) => this.tone(180, 0.35, { gain: 0.04, type: 'sawtooth', freqEnd: 140, delay: d }));
  }

  gasp() {
    if (this.clip('gasp', { gain: 0.5 })) return;
    this.noise(0.5, { gain: 0.14, attack: 0.04, filter: 'bandpass', freq: 1100, freqEnd: 420, q: 0.7 });
  }

  cheer() {
    if (this.clip('cheer', { gain: 0.6 })) return;
    this.noise(1.0, { gain: 0.14, attack: 0.12, filter: 'bandpass', freq: 600, freqEnd: 850, q: 0.6 });
    this.noise(0.8, { gain: 0.08, attack: 0.2, filter: 'bandpass', freq: 1400, q: 0.9, delay: 0.05 });
  }

  // Low health: your own heart.
  heartbeat() {
    if (this.clip('heartbeat', { gain: 0.9, vary: 0.02 })) return;
    this.tone(55, 0.16, { gain: 0.5, freqEnd: 40 });
    this.tone(52, 0.2, { gain: 0.38, freqEnd: 38, delay: 0.22 });
  }

  // Dull wooden thud on the shield.
  block() {
    if (this.clip('block_shield', { gain: 1 })) return;
    this.tone(150, 0.16, { gain: 0.55, freqEnd: 60, type: 'sine' });
    this.noise(0.1, { gain: 0.45, filter: 'lowpass', freq: 900, q: 0.7 });
    this.tone(320, 0.06, { gain: 0.15, type: 'triangle' });
  }

  shieldBreak() {
    if (this.clip('shield_break', { gain: 0.95 })) { this.clip('clash_heavy', { gain: 0.45, rate: 0.9 }); return; }
    this.noise(0.35, { gain: 0.5, filter: 'lowpass', freq: 1400, freqEnd: 200 });
    this.tone(110, 0.3, { gain: 0.4, freqEnd: 50, type: 'sawtooth' });
  }

  // Steel grinding on steel (the blade lock's struggle).
  scrape() {
    this.clip('scrape', { gain: 0.45 });
  }

  // The galleries' murmur: a recorded crowd, looped quietly under the duel.
  _crowdClip(on) {
    if (on) {
      if (this.crowdClip) return true;
      if (!this._ok() || !this.clips || !this.clips.crowd_loop || !this.clips.crowd_loop.length) return false;
      const src = this.ctx.createBufferSource();
      src.buffer = this.clips.crowd_loop[0];
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.22, this.ctx.currentTime + 1.5);
      src.connect(g);
      g.connect(this.master);
      src.start();
      this.crowdClip = { src, g };
      return true;
    }
    if (!this.crowdClip) return false;
    const { src, g } = this.crowdClip;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.6);
    src.stop(t + 0.7);
    this.crowdClip = null;
    return true;
  }

  // A heavy bind of blades (the blade lock).
  clashHeavy() {
    if (this.clip('clash_heavy', { gain: 1 })) return;
    this.parry();
  }

  // A weapon dropped on stone (the disarm).
  clatter() {
    if (this.clip('clatter', { gain: 0.85 })) return;
    this.hitArmour('plate');
  }

  // Steel drawn from the scabbard (a duel begins).
  draw() {
    this.clip('draw', { gain: 0.7, vary: 0.03 });
  }

  // The Book of Arms: 'open', 'flip' or 'close'.
  book(kind = 'open') {
    this.clip(`book_${kind}`, { gain: 0.6, vary: 0.03 });
  }

  swipe() {
    if (this.clip('swing', { gain: 0.8, rate: 0.88 })) return;
    this.noise(0.14, { gain: 0.13, attack: 0.02, filter: 'bandpass', freq: 600, freqEnd: 2600, q: 1.4 });
  }

  dodge() {
    if (this.clip('dodge', { gain: 0.7 })) return;
    this.noise(0.22, { gain: 0.25, attack: 0.04, filter: 'bandpass', freq: 380, freqEnd: 900, q: 0.9 });
  }

  // You strike flesh/mail.
  hit() {
    this.noise(0.12, { gain: 0.6, filter: 'bandpass', freq: 1500, freqEnd: 500, q: 0.8 });
    this.tone(180, 0.12, { gain: 0.35, freqEnd: 90, type: 'triangle' });
  }

  // You take a blow: low thump.
  hurt() {
    if (this.clip('hit_plate', { gain: 0.6, rate: 0.75 })) { this.tone(85, 0.22, { gain: 0.4, freqEnd: 40 }); return; }
    this.tone(85, 0.28, { gain: 0.8, freqEnd: 38, type: 'sine' });
    this.noise(0.16, { gain: 0.4, filter: 'lowpass', freq: 500 });
  }

  glint(red) {
    if (red ? this.clip('bell', { gain: 0.4, rate: 0.55, vary: 0.02 }) : this.clip('chime', { gain: 0.3, rate: 1.25 })) return;
    if (red) {
      this.tone(98, 0.45, { gain: 0.22, type: 'sawtooth', attack: 0.06 });
      this.tone(147, 0.45, { gain: 0.12, type: 'sawtooth', attack: 0.06 });
    } else {
      this.tone(2637, 0.22, { gain: 0.08 });
      this.tone(3951, 0.15, { gain: 0.05, delay: 0.02 });
    }
  }

  windowOpen() {
    if (this.clip('chime', { gain: 0.22, rate: 1.7 })) return;
    this.tone(3520, 0.08, { gain: 0.05 });
  }

  stagger() {
    if (this.clip('bell', { gain: 0.45, rate: 0.8, vary: 0.02 })) { this.tone(70, 0.5, { gain: 0.4, freqEnd: 40 }); return; }
    this.tone(70, 0.6, { gain: 0.6, freqEnd: 40, type: 'sine' });
    this.tone(523, 0.5, { gain: 0.08, type: 'triangle' });
    this.tone(784, 0.5, { gain: 0.06, type: 'triangle', delay: 0.06 });
  }

  combo() {
    if (this.clip('chime', { gain: 0.3, rate: 1.0 })) { [1.26, 1.5, 2.0].forEach((r, i) => this.clip('chime', { gain: 0.3, rate: r, delay: 0.06 * (i + 1), vary: 0 })); return; }
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { gain: 0.1, type: 'triangle', delay: i * 0.05 }));
  }

  superBurst() {
    if (this.clip('bell', { gain: 0.6, rate: 1.2, vary: 0 })) { this.clip('roar', { gain: 0.5 }); return; }
    this.noise(0.6, { gain: 0.4, filter: 'bandpass', freq: 300, freqEnd: 4000, q: 0.8 });
    [392, 523, 659, 784].forEach((f) => this.tone(f, 1.0, { gain: 0.09, type: 'triangle' }));
  }

  bell() {
    if (this.clip('bell', { gain: 0.8, vary: 0.02 })) return;
    const base = 196;
    [0.5, 1, 1.19, 1.5, 2, 2.52, 3.01, 4.1].forEach((m, i) => {
      this.tone(base * m, 3.2 - i * 0.3, { gain: 0.14 / (1 + i * 0.4), attack: 0.004 });
    });
  }

  defeat() {
    if (this.clip('death', { gain: 0.85, rate: 0.85 })) return;
    this.tone(110, 1.6, { gain: 0.3, type: 'sawtooth', freqEnd: 55, attack: 0.05 });
    this.tone(82, 1.8, { gain: 0.3, type: 'sine', attack: 0.05 });
  }

  click() {
    if (this.clip('click', { gain: 0.45, vary: 0.03 })) return;
    this.tone(1200, 0.04, { gain: 0.08, type: 'triangle' });
  }

  // His blade leaving the wind-up: an audible 'now'.
  whoosh(heavy = false) {
    if (this.clip('swing', { gain: heavy ? 0.9 : 0.75, rate: heavy ? 0.7 : 0.85 })) { if (heavy) this.clip('whoosh_heavy', { gain: 0.5 }); return; }
    this.noise(heavy ? 0.26 : 0.18, { gain: heavy ? 0.3 : 0.22, attack: 0.03, filter: 'bandpass', freq: heavy ? 260 : 420, freqEnd: heavy ? 900 : 1500, q: 1.4 });
  }

  // The crowd in the galleries: a swelling roar.
  roar() {
    if (this.clip('roar', { gain: 0.65 })) return;
    this.noise(2.6, { gain: 0.22, attack: 0.35, filter: 'bandpass', freq: 520, freqEnd: 700, q: 0.6 });
    this.noise(2.2, { gain: 0.14, attack: 0.5, filter: 'bandpass', freq: 1200, freqEnd: 1500, q: 0.8, delay: 0.15 });
    [0.3, 0.55, 0.9, 1.2].forEach((d, i) => this.tone(520 + i * 90, 0.25, { gain: 0.04, type: 'triangle', freqEnd: 700 + i * 80, delay: d }));
  }

  laugh() {
    if (this.clip('laugh', { gain: 1, rate: 0.72, vary: 0 })) return;
    [0, 0.18, 0.36].forEach((d) => this.tone(120, 0.14, { gain: 0.3, type: 'sawtooth', freqEnd: 90, delay: d }));
  }
}

export const Sfx = new SfxEngine();
