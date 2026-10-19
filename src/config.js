// Every tunable number in the game lives here.

// '3d' when loaded from the /3d/ test page (it sets window.LOGRES_MODE first).
export const MODE = (typeof window !== 'undefined' && window.LOGRES_MODE) || '2d';

// View dimensions are decided once at boot from the device (see main.js).
export const VIEW = {
  H: 540,        // logical height; all layout is in these units
  W: 960,        // logical width, set from the screen aspect at boot
  RES: 1,        // render resolution multiplier (crisp text/art on high-DPI screens)
  maxRes: 2,
  minAspect: 1.4,
  maxAspect: 2.2,
  safeL: 0,      // safe-area insets in logical units
  safeR: 0,
  safeB: 0,
};

export const FONT = '"Cinzel", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';

export const PALETTE = {
  ink: 0x2a1d14,
  inkCss: '#2a1d14',
  parchment: 0xf1e3c4,
  parchmentCss: '#f1e3c4',
  parchmentDark: '#d9c296',
  gold: 0xd9a933,
  goldCss: '#d9a933',
  goldLight: '#f6dc8a',
  goldDark: '#8a6416',
  lapis: 0x2b4a9b,
  lapisCss: '#2b4a9b',
  lapisDark: '#1b2c63',
  vermilion: 0xc8361f,
  vermilionCss: '#c8361f',
  green: '#3f7a3a',
};

export const CONFIG = {
  swipe: {
    minDistPx: 40,          // CSS pixels of travel for a valid swipe
    maxDurationMs: 350,     // the travelling part of the swipe must fit in this
    earlyTriggerMult: 2.2,  // a swipe fires mid-drag once travel reaches minDist * this
    trailFadeMs: 200,
    trailWidth: 9,
    bufferMs: 280,          // a swipe made while the arm is busy is kept this long
  },

  player: {
    baseHealth: 100,
    baseDamage: 10,
    attackMs: 120,          // time the sword arm is busy after a swipe
    stunMs: 300,
    hitChainMs: 250,        // hits within this of each other build the counter
  },

  dodge: {
    durationMs: 350,
    perfectMs: 160,         // impact within this long after the dodge began = perfect dodge
    shift: 150,             // how far the world slides on a dodge
  },

  block: {
    raiseMs: 70,
    perfectMs: 170,         // shield raised this close to impact = perfect block (no pip spent)
  },

  counter: {
    openMs: 850,            // a perfect dodge or perfect block breaks his combo and opens him this long
  },

  riposte: {
    damageMult: 2,          // the first cut after a parry, along the shown chevron
    stagger: 20,
  },

  parry: {
    windowMs: 180,          // final ms before impact during which a parry counts
    angleSteps: 1,          // ±1 of the 8 directions = ±45°
  },

  stagger: {
    max: 100,
    fromParry: 45,
    fromPerfectDodge: 22,
    fromDodge: 8,
    fromBlock: 10,
    fromPerfectBlock: 30,
    durationMs: 2000,
    damageMult: 1.5,
  },

  super: {
    max: 100,
    fromParry: 22,
    fromPerfectDodge: 12,
    fromDodge: 6,
    fromBlock: 7,
    fromPerfectBlock: 12,
    fromHit: 3,
    staggerMs: 2500,
    damageMult: 2,
  },

  parriedOpenMs: 900,       // enemy is open this long after being parried (if not staggered)

  combos: [
    { id: 'cross', name: 'Pendragon Cross', seq: ['E', 'W', 'S'], damage: 30 },
    { id: 'sun', name: "Gawain's Sun", seq: ['N', 'S', 'N'], damage: 30 },
    { id: 'lake', name: 'Blade of the Lake', seq: ['SW', 'SE', 'N'], damage: 36 },
  ],

  juice: {
    hitStopMs: 70,
    parryStopMs: 120,
    parrySlowScale: 0.3,    // a beat of slow motion after the clash
    parrySlowMs: 320,
    takenStopMs: 60,
    comboStopMs: 110,
    shakeHit: { ms: 90, intensity: 0.004 },
    shakeTaken: { ms: 160, intensity: 0.008 },
    shakeHeavy: { ms: 280, intensity: 0.016 },
    flashMs: 45,
    slowMoScale: 0.3,
    slowMoMs: 600,
    vibrateHitMs: 40,
    vibrateParryMs: [20, 30, 20],
    damageFloatMs: 700,
  },

  enemy: {
    strikeMs: 110,          // visual swing after impact
    strikeHoldMs: 160,
    feintRecoverMs: 320,
    earlyDodgeDelayMs: 260, // extra wait a dodge-punisher adds after your dodge ends
    cycleMult: 0.2,         // +20% health and damage per completed cycle
    phaseInterludeMs: 1400,
  },

  progression: {
    xpBase: 60,
    xpPerLevel: 40,
    healthPerLevel: 0.05,
    damagePerLevel: 0.03,
    lossXpFraction: 0.25,
  },

  swords: [
    { id: 'squire', name: "Squire's Sword", damage: 1.0, tolerance: 1.0, unlockGen: 1, color: '#c9ccd4', hilt: '#8a6416' },
    { id: 'clarent', name: 'Clarent', damage: 1.2, tolerance: 1.12, unlockGen: 2, color: '#dfe3ea', hilt: '#d9a933' },
    { id: 'excalibur', name: 'Excalibur', damage: 1.45, tolerance: 1.25, unlockGen: 4, color: '#f3f6fb', hilt: '#f6dc8a' },
  ],

  shields: [
    { id: 'targe', name: 'Ash Targe', pips: 3, regenMs: 4000, unlockGen: 1, field: '#7a4b2a', charge: 'boss' },
    { id: 'kite', name: 'Kite of Logres', pips: 4, regenMs: 3600, unlockGen: 3, field: '#c8361f', charge: 'cross' },
    { id: 'pridwen', name: 'Pridwen', pips: 5, regenMs: 3000, unlockGen: 5, field: '#2b4a9b', charge: 'crowns' },
  ],

  tutorial: {
    dodgeFreezeAt: 300,     // ms before impact where the game waits for a dodge
    blockFreezeAt: 300,
    parryFreezeAt: 110,
    openHoldMs: 2600,
  },

  debug: {
    tapsToToggle: 5,
    tapWindowMs: 2000,
    cornerSize: 44,
  },
};
