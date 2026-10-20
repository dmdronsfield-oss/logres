// Every tunable number in the game lives here.

// '3d' when loaded from the /3d/ test page (it sets window.LOGRES_MODE first).
// The release, shown on the title screen (bumped with the service worker's VERSION).
export const BUILD = 'v59';

export const MODE = (typeof window !== 'undefined' && window.LOGRES_MODE) || '2d';

// View dimensions are decided once at boot from the device (see main.js).
export const VIEW = {
  H: 540,        // logical height; all layout is in these units
  W: 960,        // logical width, set from the screen aspect at boot
  RES: 1,        // render resolution multiplier (crisp text/art on high-DPI screens)
  maxRes: 2,
  minAspect: 1.4,
  maxAspect: 2.2,
  portrait: false, // the side view also plays upright; layout is chosen at boot
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
    bufferMs: 200,          // a swipe made this late in a swing is kept and follows on; earlier ones are dropped
  },

  player: {
    baseHealth: 100,
    baseDamage: 16,          // (20 before brief 33's Breaks of six or more cuts; 14 before the weightier 0.42 s cut; 10 before brief 29's one-cut-at-a-time)
    attackMs: 420,          // the sword arm is busy for the whole cut (coil, cut, follow-through)
    contactMs: 175,          // the blade reaches him this long into the swing; the hit lands then
    offBalanceMs: 320,      // a cut that rings off his guard leaves you off balance this long
    timedCutMs: 400,        // the first cut landing this soon after he opens is a Timed cut
    timedCutMult: 1.5,
    rushedMult: 0.6,        // a cut swiped for again early in the last one (flailing) bites this much
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
    perfectMs: 120,         // shield raised this close to impact = perfect block (no pip spent)
  },

  // Brief 33, the Infinity Blade rhythm: a parry inside his combination is only a clash, and the
  // reward for answering the whole chain is the Break, a long opening.
  chain: {
    clashDelayMs: 150,        // a parry inside his combination holds his next blow back this much beyond its usual gap
    breakOpenMs: 2500,        // answer every blow of a combination (dodge, block or parry) and he is open this long
    breakParriedOpenMs: 3500, // the Break is this long when every blow of the combination was parried
  },

  lock: {
    lastMs: 70,             // a parry this close to impact binds the blades (blade lock)
    maxMs: 2600,            // the struggle is decided by then
    tapPush: 0.075,         // each tap drives him back this much (the bar runs 0..1 from 0.5)
    pushPerSec: 0.34,       // his strength; scaled by the foe's lockPush
    winStaggerMs: 1600,
    loseDamage: 0.6,        // fraction of the blow's damage when he forces you down
  },

  guard: {
    shiftMs: [1600, 2800],  // how long he holds a guard while waiting
    gapDamage: 0.5,         // a cut through the gap in his guard
    hurryMs: 320,           // after you find a gap he attacks within this
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
    fromPerfectBlock: 22,
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

  parriedOpenMs: 900,       // open this long after a parry on the last blow of a combination that wasn't answered in full (a full answer is a Break)
  disarm: { parries: 3, openMs: 2600 },   // parries in a row to disarm him; how long he's open

  // Known strikes' bonus blows, scaled with baseDamage (30/30/36 at 20; brief 33): a Break holds
  // a whole sequence or two, so they stay a bonus and not the bulk of the damage.
  combos: [
    { id: 'cross', name: 'Pendragon Cross', seq: ['E', 'W', 'S'], damage: 24 },
    { id: 'sun', name: "Gawain's Sun", seq: ['N', 'S', 'N'], damage: 24 },
    { id: 'lake', name: 'Blade of the Lake', seq: ['SW', 'SE', 'N'], damage: 29 },
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
