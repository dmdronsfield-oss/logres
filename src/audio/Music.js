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
// Recorded music, streamed (not decoded into memory) and routed through the master volume:
//   abbey  "Wendale Abbey", plainsong by Yubatake (CC-BY 4.0, OpenGameArt.org): the menus
//   heroic "Heroic Demise (updated)" by Matthew Pablo (CC-BY 3.0, OpenGameArt.org): duels
//   boss   "Epic Boss Battle" by Juhani Junkala (CC0, OpenGameArt.org): the Green Knight,
//          and any foe's last stand or a blade lock
// The synthesised music below plays only if a track can't be loaded.
const TRACKS = {
  abbey: { url: new URL('../../assets/audio/wendale-abbey.mp3', import.meta.url).href, level: 0.5 },
  heroic: { url: new URL('../../assets/audio/music-heroic.mp3', import.meta.url).href, level: 0.36 },
  boss: { url: new URL('../../assets/audio/music-boss.mp3', import.meta.url).href, level: 0.42 },
};
const MOOD_TRACK = { abbey: 'abbey', duel: 'heroic', boss: 'boss', stand: 'boss', victory: 'heroic', camp: null, silence: null };

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
    this._apply();
  }

  // Make the track elements and start each one inside the first tap (iPhones only let an
  // audio element play later if it has played once from a tap), then pause them again.
  prime() {
    if (this.primed || !Sfx.ctx) return;
    this.primed = true;
    for (const name of Object.keys(TRACKS)) {
      const t = this._track(name);
      if (!t) continue;
      const p = t.el.play();
      if (p && p.then) p.then(() => { if (this._wantTrack() !== name) t.el.pause(); }).catch(() => {});
    }
  }

  _track(name) {
    this.tracks = this.tracks || {};
    if (this.tracks[name]) return this.tracks[name];
    if (!Sfx.ctx || typeof Audio === 'undefined') return null;
    const el = new Audio();
    el.src = TRACKS[name].url;
    el.loop = true;
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    let node;
    try { node = Sfx.ctx.createMediaElementSource(el); } catch (e) { return null; }
    const g = Sfx.ctx.createGain();
    g.gain.value = 0;
    node.connect(g);
    g.connect(Sfx.master);
    const t = { el, g, failed: false };
    el.addEventListener('error', () => { t.failed = true; this._apply(); });
    this.tracks[name] = t;
    return t;
  }

  _wantTrack() {
    return this.on ? MOOD_TRACK[this.mood] || null : null;
  }

  // Crossfade to the mood's track; the synthesised music covers only for a track that failed.
  _apply() {
    if (!this._ready()) return;
    const want = this._wantTrack();
    const now = Sfx.ctx.currentTime;
    for (const name of Object.keys(TRACKS)) {
      const t = name === want || (this.tracks && this.tracks[name]) ? this._track(name) : null;
      if (!t) continue;
      const on = name === want && !t.failed;
      t.g.gain.cancelScheduledValues(now);
      t.g.gain.setValueAtTime(t.g.gain.value, now);
      t.g.gain.linearRampToValueAtTime(on ? TRACKS[name].level : 0, now + (on ? 2.0 : 1.2));
      if (on && t.el.paused) { const p = t.el.play(); if (p && p.catch) p.catch(() => {}); }
      if (!on && !t.el.paused) {
        clearTimeout(t.pauseTimer);
        t.pauseTimer = setTimeout(() => { if (this._wantTrack() !== name) t.el.pause(); }, 1400);
      }
    }
    const fallback = want && this.tracks && this.tracks[want] && this.tracks[want].failed;
    const synth = this.on && this.mood !== 'silence' && this.mood !== 'abbey' && (!want || fallback) && this.mood !== 'victory';
    this._fadeTo(synth ? (this.mood === 'camp' ? 0.5 : 0.62) : 0, 1.2);
  }

  // abbey (the menus' chant) | duel | boss (the Green Knight) | stand (last stand / blade lock)
  // | victory | camp | silence
  play(mood, force = false) {
    if (this.mood === mood && !force) return;
    this.mood = mood;
    this.target = { camp: 0.15, duel: 0.55, boss: 0.8, stand: 1, victory: 0.4, silence: 0, abbey: 0 }[mood] ?? 0.5;
    if (!this.timer) this.timer = setInterval(() => this._tick(), 90);
    this._apply();
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
    // Music waits for the audio to be unlocked by a tap; start the mood's track once it is.
    if (!this.applied) { this.applied = true; this._apply(); }
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
// Prime the music's audio elements inside the first tap.
Sfx.onUnlock = [...(Sfx.onUnlock || []), () => Music.prime()];
