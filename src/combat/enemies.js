// Enemies are pure data. Adding a new enemy = adding an entry to ENEMIES;
// the run sequence is the order of this array.
//
// Attack fields:
//   telegraphMs  wind-up time (gold glint shown at the start point of the blow)
//   direction    direction the blow travels on screen: N NE E SE S SW W NW, or 'T' for a thrust
//   dodge        which dodge buttons avoid it: ['left'], ['right'], ['left','right'] or [] (thrusts)
//   parryable    false = red glint; can only be dodged or blocked
//   parryDirs    optional: swipe directions that parry it (default: opposite of `direction`)
//   damage       damage before level/cycle scaling
//   recoverMs    how long the enemy is Open after a combo ending with this attack
//   heavy        bigger shake when it lands
//   unblockable  goes through the shield: only a dodge works (the Saxon's shield bash)
//   bash         drawn as a shield charge rather than a weapon blow
//   hesitate     [fraction, ms]: the wind-up stops at that point for ms before falling
//
// openLimit (per foe or per phase): { cuts, react } - after that many cuts in one
// opening he recovers: 'hop' (slips back out of reach) or 'counter' (turns your
// next cut and answers). Staggers ignore it.
//
// Horizontal slashes are dodged against the blade's travel (an E slash is dodged left).

const slash = (dir, t, dmg, rec, extra = {}) => ({
  telegraphMs: t,
  direction: dir,
  dodge: dir.includes('E') ? ['left'] : ['right'],
  parryable: true,
  damage: dmg,
  recoverMs: rec,
  ...extra,
});

const overhead = (t, dmg, rec, extra = {}) => ({
  telegraphMs: t,
  direction: 'S',
  dodge: ['left', 'right'],
  parryable: true,
  damage: dmg,
  recoverMs: rec,
  ...extra,
});

const thrust = (t, dmg, rec, extra = {}) => ({
  telegraphMs: t,
  direction: 'T',
  dodge: [],
  parryable: true,
  parryDirs: ['E', 'W'],
  damage: dmg,
  recoverMs: rec,
  ...extra,
});

export const ENEMIES = [
  {
    id: 'saxon',
    taunt: 'bang',
    name: 'Saxon Raider',
    epithet: 'come over the grey sea',
    scene: 'forest',
    health: 180,
    size: 1.0,
    weapon: 'axe',
    offhand: 'round',
    xp: 45,
    // Third-person (voxel) look and tourney crest.
    look: {
      tabard: '#8a5a32', trim: '#d9a933', charge: 'chevron', helm: 'nasal', helmColor: '#9ea4ad',
      beard: '#c8892e', skin: '#e2b48a', mail: '#7d8289', metal: '#9ea4ad', cape: '#5a3a22',
    },
    crest: { field: '#8a5a32', charge: 'axes' },
    idleMs: [1100, 1800],
    comboGapMs: [300, 400],
    feintChance: 0,
    palette: {
      body: '#8a5a32', trim: '#d9a933', belt: '#3b2716', legs: '#6e5a44', boots: '#3b2716',
      sleeve: '#8a5a32', hand: '#e2b48a', skin: '#e2b48a', beard: '#c8892e', helm: 'spangen',
      helmColor: '#9ea4ad', blade: '#c9ccd4', shield: '#c8361f', shieldCharge: 'boss', device: 'chevron',
    },
    attacks: {
      overhead: overhead(950, 14, 1500),
      slashE: slash('E', 1000, 12, 1400),
      slashW: slash('W', 1000, 12, 1400),
      // Signature: he drives his round shield at you. Dodge it.
      bash: {
        telegraphMs: 1050, direction: 'T', dodge: ['left', 'right'], parryable: false, unblockable: true, bash: true,
        damage: 15, recoverMs: 1500, heavy: true,
      },
    },
    combos: [
      { seq: ['overhead'], weight: 2 },
      { seq: ['slashE'], weight: 1 },
      { seq: ['slashW'], weight: 1 },
      { seq: ['bash'], weight: 1 },
    ],
  },
  {
    id: 'black',
    taunt: 'salute',
    name: 'The Black Knight',
    epithet: 'who holds the ford',
    scene: 'hall',
    health: 320,
    size: 1.05,
    weapon: 'sword',
    offhand: 'heater',
    xp: 70,
    look: {
      tabard: '#1f1e24', trim: '#c9ccd4', charge: 'cross', chargeColor: '#e0e0e0', helm: 'greathelm',
      helmColor: '#2e2e36', mail: '#4a4a52', metal: '#3a3a44', cape: '#141318', skin: '#d9b08c',
      // Worn over INKXO's plate harness: blackened steel, silvered edges, a black plume.
      model: 'inkxo', tint: '#3a3b42', trimTint: '#9a9ca6', plumeTint: '#26262c',
    },
    crest: { field: '#1f1e24', charge: 'cross', color: '#e0e0e0' },
    idleMs: [800, 1400],
    comboGapMs: [250, 400],
    feintChance: 0,
    palette: {
      body: '#26252b', trim: '#c9ccd4', belt: '#111', legs: '#3a3a42', boots: '#1a1a1e',
      sleeve: '#3a3a42', hand: '#55565f', skin: '#d9b08c', helm: 'greathelm', helmColor: '#3a3a42',
      blade: '#c9ccd4', shield: '#1d1c21', shieldCharge: 'bend', device: 'cross',
    },
    attacks: {
      overhead: overhead(720, 16, 950),
      slashE: slash('E', 680, 14, 950),
      slashW: slash('W', 680, 14, 950),
      crusher: overhead(1150, 28, 1300, { parryable: false, heavy: true }),
      // Signature: the blow stops at the top of the wind-up before it falls.
      hesitate: overhead(1150, 18, 1100, { hesitate: [0.5, 420] }),
    },
    combos: [
      { seq: ['slashE', 'slashW'], weight: 2 },
      { seq: ['slashW', 'overhead'], weight: 2 },
      { seq: ['overhead', 'slashE'], weight: 1 },
      { seq: ['crusher'], weight: 1 },
      { seq: ['hesitate'], weight: 1 },
      { seq: ['slashE', 'hesitate'], weight: 1 },
    ],
  },
  {
    id: 'brigand',
    taunt: 'point',
    openLimit: { cuts: 3, react: 'hop' },
    name: 'The Brigand Captain',
    epithet: 'of the Wirral road',
    scene: 'road',
    health: 380,
    size: 0.98,
    weapon: 'falchion',
    offhand: 'buckler',
    xp: 95,
    look: {
      tabard: '#5c6a35', trim: '#c8a24a', charge: null, helm: 'hood', helmColor: '#4b5a2a', beard: '#3b2716',
      skin: '#d4a57c', mail: '#6e5a44', metal: '#7a6a52', cape: '#4b3a24',
    },
    crest: { field: '#4b5a2a', charge: 'star' },
    idleMs: [600, 1100],
    comboGapMs: [150, 260],
    feintChance: 0,
    palette: {
      body: '#5c6a35', trim: '#c8a24a', belt: '#3b2716', legs: '#5a4630', boots: '#2e2014',
      sleeve: '#7a5a3a', hand: '#d4a57c', skin: '#d4a57c', beard: '#3b2716', helm: 'hood',
      helmColor: '#4b5a2a', blade: '#c9ccd4', shield: '#8a5a32', shieldCharge: 'boss', device: 'studs',
    },
    attacks: {
      slashE: slash('E', 440, 10, 650),
      slashW: slash('W', 440, 10, 650),
      slashSE: slash('SE', 460, 10, 650),
      slashSW: slash('SW', 460, 10, 650),
      overhead: overhead(500, 12, 700),
      thrust: thrust(620, 14, 700),
    },
    combos: [
      { seq: ['slashE', 'slashW', 'slashE'], weight: 2 },
      { seq: ['slashSE', 'slashSW', 'slashE', 'slashW'], weight: 1 },
      { seq: ['slashW', 'slashE', 'overhead'], weight: 2 },
      { seq: ['slashE', 'slashW', 'thrust'], weight: 1 },
      { seq: ['thrust'], weight: 1 },
    ],
  },
  {
    id: 'red',
    taunt: 'raise',
    openLimit: { cuts: 3, react: 'counter' },
    name: 'The Red Knight',
    epithet: 'of the Red Lands',
    scene: 'field',
    health: 440,
    size: 1.05,
    weapon: 'sword',
    offhand: null,
    xp: 120,
    look: {
      tabard: '#a52a18', trim: '#e3b440', charge: 'lion', helm: 'greathelm', helmColor: '#9a2a1c', crest: '#e3b440',
      mail: '#6e3a30', metal: '#9a2a1c', cape: '#7a1a10', skin: '#d9b08c',
      // Worn over INKXO's plate harness: red-lacquered steel, gilt edges, a red plume.
      model: 'inkxo', tint: '#c2473a', trimTint: '#f0c060', plumeTint: '#b02018',
    },
    crest: { field: '#a52a18', charge: 'lion' },
    idleMs: [700, 1300],
    comboGapMs: [200, 350],
    feintChance: 0.35,
    punishEarlyDodge: true,
    palette: {
      body: '#a52a18', trim: '#e3b440', belt: '#3b1610', legs: '#7a2014', boots: '#2a1410',
      sleeve: '#8a2416', hand: '#6e1c12', skin: '#d9b08c', helm: 'greathelm', helmColor: '#9a2a1c',
      crest: '#e3b440', blade: '#dfe3ea', hilt: '#e3b440', device: 'lion',
    },
    attacks: {
      overhead: overhead(650, 17, 900),
      slashE: slash('E', 620, 15, 900),
      slashW: slash('W', 620, 15, 900),
      thrust: thrust(700, 16, 900),
      reap: slash('E', 1000, 26, 1200, { parryable: false, heavy: true }),
    },
    combos: [
      { seq: ['overhead'], weight: 2 },
      { seq: ['slashW', 'slashE'], weight: 2 },
      { seq: ['thrust', 'overhead'], weight: 1 },
      { seq: ['slashE', 'thrust', 'slashW'], weight: 1 },
      { seq: ['reap'], weight: 1 },
    ],
  },
  {
    id: 'green',
    taunt: 'laugh',
    name: 'The Green Knight',
    epithet: 'of the Green Chapel',
    scene: 'chapel',
    health: 640,
    size: 1.2,
    weapon: 'greataxe',
    offhand: 'holly',
    xp: 220,
    look: {
      tabard: '#3f8a35', trim: '#c9b04a', charge: null, helm: 'antler', helmColor: '#356a35', antler: '#d8c8a8',
      mail: '#3a5e36', metal: '#4f8a45', leafy: true, skin: '#8cc27a',
      // The last round: INKXO's harness in green and gold, with his antlers, cloak, axe and holly.
      model: 'inkxo', tint: '#5f9e4c', trimTint: '#e0b84e', plumeTint: '#3f7a35',
    },
    crest: { field: '#24502a', charge: 'stag' },
    idleMs: [900, 1500],
    comboGapMs: [250, 400],
    feintChance: 0,
    palette: {
      body: '#2f6b2a', trim: '#e3b440', belt: '#1e3d1a', legs: '#2a5a26', boots: '#1e3d1a',
      sleeve: '#3f7a3a', hand: '#7fb36a', skin: '#8cc27a', beard: '#2f6b2a', hair: '#3f8a35', helm: 'wild',
      blade: '#b8d4a8', device: 'holly',
    },
    attacks: {
      sweepE: slash('E', 1200, 36, 1200, { parryable: false, heavy: true }),
      sweepW: slash('W', 1200, 36, 1200, { parryable: false, heavy: true }),
      chop: overhead(1300, 40, 1500, { parryable: false, heavy: true }),
      jab: thrust(460, 14, 600),
    },
    combos: [
      { seq: ['sweepE'], weight: 2 },
      { seq: ['sweepW'], weight: 2 },
      { seq: ['jab', 'jab'], weight: 2 },
      { seq: ['jab', 'sweepW'], weight: 1 },
      { seq: ['chop'], weight: 1 },
    ],
    // Second phase at half health: faster and meaner.
    phases: [
      {
        atHealth: 0.5,
        message: 'He laughs, and the holly burns green',
        openLimit: { cuts: 4, react: 'counter' },
        telegraphMult: 0.82,
        idleMs: [500, 900],
        comboGapMs: [180, 300],
        feintChance: 0.15,
        combos: [
          { seq: ['jab', 'jab', 'sweepE'], weight: 2 },
          { seq: ['sweepW', 'sweepE'], weight: 2 },
          { seq: ['jab', 'chop'], weight: 1 },
          { seq: ['jab', 'jab', 'jab'], weight: 1 },
          { seq: ['chop'], weight: 1 },
        ],
      },
    ],
  },
];
