import { CONFIG, MODE } from '../config.js';

// The 3D test keeps its own progress so it doesn't disturb the 2D game.
const CAM = typeof window !== 'undefined' && window.LOGRES_CAM === 'side' ? `side${window.LOGRES_MODEL ? `-${window.LOGRES_MODEL}` : ''}` : '';
const KEY = MODE === '3d' ? `logres.save.3d${CAM}.v1` : 'logres.save.v1';

const DEFAULTS = {
  generation: 1,
  cycle: 0,          // completed sweeps of the whole enemy sequence
  runStage: 0,       // index of the next enemy in the sequence
  currentRun: 0,     // duels won since the last death
  bestRun: 0,
  xp: 0,
  level: 1,
  sword: 'squire',
  shield: 'targe',
  muted: false,
  vibration: true,
  leftHanded: false,
  tutorialDone: false,
  superHintShown: false,
  redHintShown: false,
  thrustHintShown: false,
  wins: 0,
  deaths: 0,
};

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

export const Save = {
  data: read(),

  write() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      // Private mode or storage blocked: the game still plays, it just won't remember.
    }
  },

  set(patch) {
    Object.assign(this.data, patch);
    this.write();
  },

  reset() {
    const keep = { muted: this.data.muted, vibration: this.data.vibration, leftHanded: this.data.leftHanded };
    this.data = { ...DEFAULTS, ...keep };
    this.write();
  },

  xpToNext(level = this.data.level) {
    const p = CONFIG.progression;
    return p.xpBase + p.xpPerLevel * (level - 1);
  },

  // Adds XP and returns how many levels were gained.
  addXp(amount) {
    let gained = 0;
    this.data.xp += amount;
    while (this.data.xp >= this.xpToNext()) {
      this.data.xp -= this.xpToNext();
      this.data.level += 1;
      gained += 1;
    }
    this.write();
    return gained;
  },

  sword() {
    return CONFIG.swords.find((s) => s.id === this.data.sword) || CONFIG.swords[0];
  },

  shield() {
    return CONFIG.shields.find((s) => s.id === this.data.shield) || CONFIG.shields[0];
  },

  unlocked(item) {
    return this.data.generation >= item.unlockGen;
  },
};
