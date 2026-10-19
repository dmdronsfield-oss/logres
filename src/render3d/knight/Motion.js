import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { DIM, solveTwoBone, bendWrist, setWorldQuat } from './Knight.js';

// Poses are authored in figure space (metres, figure facing +z, his right hand
// on -x): where the hands go, which way the blade points, where the feet stand,
// how the hips and chest turn. Moves are keyframed clips over those poses:
// hands travel in arcs round the shoulder, the hips lead and the blade lags
// (overlapping action), weight shifts back to load and forward to strike.
// IK turns poses into joint rotations; feet stay planted.

export const KEYS = ['pelvis', 'pelvisRot', 'chest', 'footL', 'footR', 'handR', 'bladeR', 'handL', 'faceL', 'poleL'];

export const pose = (from, over = {}) => {
  const p = {};
  for (const k of KEYS) p[k] = (over[k] || from[k]).slice();
  return p;
};

const add = (a, b) => a.map((v, i) => v + (b[i] || 0));

// ---------- guards ----------

export const GUARD = {
  // Sword (or axe) and shield: left side leading, weapon up, shield forward.
  ss: {
    pelvis: [0, 0.94, 0], pelvisRot: [0, -0.24, 0], chest: [0.06, 0.18, 0],
    footL: [0.16, 0.2, 0.3], footR: [-0.2, -0.22, -0.4],
    handR: [-0.3, 1.18, 0.3], bladeR: [0.1, 0.88, 0.45],
    handL: [0.14, 1.2, 0.36], faceL: [0.05, 0.05, 1], poleL: [1, -0.8, -0.2],
  },
  // The Green Knight: wide A-frame, arms held out from the body, axe hanging.
  giant: {
    pelvis: [0, 0.97, 0], pelvisRot: [0, 0, 0], chest: [-0.06, 0, 0],
    footL: [0.3, 0.06, 0.18], footR: [-0.3, -0.06, -0.18],
    handR: [-0.46, 1.0, 0.16], bladeR: [0.15, -0.95, 0.25],
    handL: [0.46, 1.0, 0.14], faceL: [0.3, 0, 1], poleL: [1, -0.2, -0.6],
  },
  // Your knight, after the reference art: a deep lunge, point raised at the foe, shield across.
  hero: {
    pelvis: [0, 0.86, 0.05], pelvisRot: [0.1, -0.18, 0], chest: [0.14, 0.12, 0],
    footL: [0.19, 0.42, 0.18], footR: [-0.21, -0.46, -0.38],
    handR: [-0.2, 1.22, 0.5], bladeR: [0.05, 0.6, 0.8],
    handL: [0.16, 1.18, 0.38], faceL: [-0.12, 0, 1], poleL: [1, -0.8, -0.2],
  },
};

// ---------- swing marks: [wind-up, impact] by direction of travel ----------
// E = the blade travels toward the figure's +x (his left): a forehand from his right.

export const SWINGS = {
  S: [
    { handR: [-0.1, 1.92, -0.12], bladeR: [0.05, 0.3, -1], chest: [-0.22, -0.1, 0] },
    // Down and across to his left, so the blade reads as a slash, not a point; shield kept forward.
    { handR: [0.06, 1.0, 0.6], bladeR: [0.42, -0.68, 0.6], chest: [0.42, 0.08, 0], footL: [0.17, 0.42, 0.25], handL: [0.26, 0.98, 0.42] },
  ],
  E: [
    { handR: [-0.6, 1.48, -0.08], bladeR: [-0.85, 0.3, -0.45], chest: [0, -0.8, 0], pelvisRot: [0, -0.5, 0] },
    { handR: [0.42, 1.16, 0.5], bladeR: [0.95, -0.08, 0.3], chest: [0.15, 0.68, 0], pelvisRot: [0, 0.3, 0], footL: [0.2, 0.42, 0.2] },
  ],
  W: [
    { handR: [0.3, 1.55, 0.04], bladeR: [0.85, 0.38, -0.38], chest: [0, 0.6, 0], pelvisRot: [0, 0.1, 0] },
    { handR: [-0.64, 1.16, 0.42], bladeR: [-0.95, -0.08, 0.3], chest: [0.15, -0.64, 0], pelvisRot: [0, -0.5, 0] },
  ],
  SE: [
    { handR: [-0.45, 1.88, -0.04], bladeR: [-0.55, 0.68, -0.48], chest: [-0.15, -0.55, 0] },
    { handR: [0.36, 0.96, 0.52], bladeR: [0.7, -0.6, 0.4], chest: [0.38, 0.5, 0] },
  ],
  SW: [
    { handR: [0.24, 1.86, -0.02], bladeR: [0.55, 0.68, -0.48], chest: [-0.15, 0.48, 0] },
    { handR: [-0.56, 0.96, 0.46], bladeR: [-0.7, -0.6, 0.4], chest: [0.38, -0.5, 0] },
  ],
  T: [
    { handR: [-0.36, 1.12, -0.22], bladeR: [0.05, 0.06, 1], chest: [0, -0.6, 0], pelvisRot: [0, -0.45, 0] },
    { handR: [-0.05, 1.3, 0.74], bladeR: [0, 0.04, 1], chest: [0.16, 0.25, 0], footL: [0.18, 0.66, 0.2] },
  ],
  N: [
    { handR: [-0.34, 0.86, 0.24], bladeR: [-0.4, -0.75, 0.4], chest: [0.26, -0.3, 0] },
    { handR: [0.0, 1.94, 0.34], bladeR: [0.1, 0.82, 0.5], chest: [-0.16, 0.2, 0] },
  ],
  NE: [
    { handR: [-0.46, 0.9, 0.28], bladeR: [-0.6, -0.6, 0.4], chest: [0.2, -0.45, 0] },
    { handR: [0.35, 1.84, 0.36], bladeR: [0.6, 0.7, 0.3], chest: [-0.12, 0.45, 0] },
  ],
  NW: [
    { handR: [0.3, 0.9, 0.34], bladeR: [0.6, -0.6, 0.4], chest: [0.2, 0.4, 0] },
    { handR: [-0.5, 1.84, 0.3], bladeR: [-0.6, 0.7, 0.3], chest: [-0.12, -0.45, 0] },
  ],
};

export const STATES = {
  open: { handR: [-0.4, 0.95, 0.32], bladeR: [0.1, -0.8, 0.6], chest: [0.26, 0, 0], pelvis: [0, 0.89, 0], handL: [0.32, 1.0, 0.24], faceL: [0.3, -0.3, 1] },
  parried: { handR: [-0.56, 1.86, -0.34], bladeR: [-0.4, 0.6, -0.7], chest: [-0.36, -0.3, 0.1], pelvis: [0, 0.96, -0.16], handL: [0.4, 1.3, 0.1] },
  staggered: {
    pelvis: [0, 0.74, -0.12], pelvisRot: [0.12, 0.22, 0.16], chest: [-0.42, 0.36, 0.3],
    handR: [-0.62, 0.95, 0.05], bladeR: [-0.4, -0.8, 0.3], handL: [0.56, 1.05, -0.05], faceL: [0.6, -0.4, 0.6],
    footL: [0.26, 0.05, 0.4], footR: [-0.25, -0.26, -0.3],
  },
  roar: {
    chest: [-0.36, 0, 0], pelvis: [0, 1.0, 0], handR: [-0.74, 1.74, 0.16], bladeR: [-0.3, 0.9, 0.1],
    handL: [0.74, 1.74, 0.16], faceL: [0.7, 0.3, 0.5], footL: [0.32, 0.05, 0], footR: [-0.32, -0.05, 0],
  },
  kneel: {
    pelvis: [0, 0.55, 0.1], pelvisRot: [0.1, 0, 0], chest: [0.45, 0, 0], footR: [-0.18, -0.48, 0], footL: [0.18, 0.3, 0],
    handR: [-0.3, 0.62, 0.4], bladeR: [0, -1, 0.15], handL: [0.3, 0.72, 0.22], faceL: [0.2, -0.5, 1],
  },
  collapse: {
    pelvis: [0.12, 0.3, 0.2], pelvisRot: [0.3, 0, 1.15], chest: [0.8, 0, 0.4], footR: [-0.18, -0.48, 0], footL: [0.18, 0.3, 0],
    handR: [-0.5, 0.3, 0.4], bladeR: [-0.2, -0.3, 1], handL: [0.4, 0.3, 0.1], faceL: [0, -1, 0.2],
  },
  block: {
    handL: [0.02, 1.42, 0.46], faceL: [0, 0.1, 1], poleL: [1, -0.4, -0.2], handR: [-0.34, 1.0, 0.14], bladeR: [-0.1, 0.6, 0.75],
    chest: [0.26, 0.05, 0], pelvis: [0, 0.8, 0.02],
  },
  // Waiting guards. High: blade raised above the head, the body below it open to a
  // horizontal cut. Low: point dropped toward you, the head and shoulders open from above.
  highGuard: {
    handR: [-0.28, 1.72, 0.12], bladeR: [0.35, 0.8, 0.45], chest: [-0.05, 0.25, 0], pelvis: [0, 0.95, 0],
    handL: [0.2, 1.25, 0.38], faceL: [0.05, 0.05, 1],
  },
  lowGuard: {
    handR: [-0.3, 0.98, 0.34], bladeR: [0.12, -0.42, 0.9], chest: [0.22, 0.1, 0], pelvis: [0, 0.88, 0.02],
    handL: [0.18, 1.02, 0.36], faceL: [0.1, -0.2, 1],
  },
  // Strike of the Pendragon: the sword raised high in both... in the sword hand, shield out wide.
  pendragon: {
    pelvis: [0, 0.98, 0], pelvisRot: [0, 0, 0], chest: [-0.28, 0, 0], handR: [-0.08, 2.05, 0.12], bladeR: [0.02, 1, 0.12],
    handL: [0.5, 1.25, 0.2], faceL: [0.4, 0, 1], footL: [0.18, 0.2, 0.2], footR: [-0.2, -0.22, -0.4],
  },
  // Taking your blow: on the shield (raised, angled into it) or on the blade, crosswise.
  shieldBlock: { handL: [0.04, 1.42, 0.5], faceL: [-0.1, 0.15, 1], poleL: [1, -0.4, -0.2], chest: [0.12, 0.2, 0], pelvis: [0, 0.9, -0.04] },
  bladeBlock: { handR: [-0.12, 1.48, 0.42], bladeR: [0.95, 0.25, 0.15], chest: [0.1, -0.1, 0], pelvis: [0, 0.9, -0.04] },
  // Blades bound: leaning in, sword hand high and forward, blade slanted across (both knights).
  lock: {
    pelvis: [0, 0.84, 0.14], pelvisRot: [0.14, -0.1, 0], chest: [0.32, 0.18, 0],
    footL: [0.2, 0.48, 0.2], footR: [-0.22, -0.46, -0.4],
    handR: [-0.1, 1.42, 0.52], bladeR: [0.55, 0.6, 0.58], handL: [0.12, 1.3, 0.44], faceL: [0, 0, 1], poleL: [1, -0.6, -0.3],
  },
  stun: { chest: [-0.36, 0, 0.12], pelvis: [0, 0.88, -0.16], handR: [-0.5, 1.04, 0.1], bladeR: [-0.3, 0.4, 0.8], handL: [0.42, 1.05, 0.15] },
  dead: {
    pelvis: [0, 0.38, -0.32], pelvisRot: [-1.15, 0, 0.1], chest: [-0.3, 0, 0], handR: [-0.6, 0.4, -0.25], bladeR: [-0.5, 0, 0.8],
    handL: [0.6, 0.4, -0.25], faceL: [0.4, 1, 0],
  },
};

// Seen from behind, your swipe's screen direction is mirrored in your knight's own frame.
const MIRROR = { E: 'W', W: 'E', NE: 'NW', NW: 'NE', SE: 'SW', SW: 'SE', N: 'N', S: 'S', T: 'T' };
export const mirrorDir = (d) => MIRROR[d] || d;

// ---------- clip sampling ----------

const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inout: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  snap: (t) => 1 - Math.pow(1 - t, 4),
  back: (t) => { const c = 1.6; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; },
};

// Overlapping action: the hips lead, the chest follows, the blade lags.
const LAG = { pelvis: -0.05, pelvisRot: -0.06, footL: -0.04, footR: -0.04, chest: -0.025, handR: 0, bladeR: 0.035, handL: -0.01, faceL: -0.01, poleL: 0 };
const SHOULDER = { handR: [-0.2, 1.46, 0], handL: [0.2, 1.46, 0] };

const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();

// Interpolate directions along the great circle (blades and swings sweep, they don't cut corners).
function slerpDir(a, b, t, out) {
  va.fromArray(a);
  vb.fromArray(b);
  const la = va.length() || 1;
  const lb = vb.length() || 1;
  va.divideScalar(la);
  vb.divideScalar(lb);
  let dot = Math.max(-1, Math.min(1, va.dot(vb)));
  if (dot > 0.9995) {
    vc.copy(va).lerp(vb, t);
  } else {
    if (dot < -0.98) {
      // Opposite: swing over the top rather than through the body.
      vb.add(vc.set(0, 0.25, 0.1)).normalize();
      dot = va.dot(vb);
    }
    const th = Math.acos(dot);
    const s = Math.sin(th);
    vc.copy(va).multiplyScalar(Math.sin((1 - t) * th) / s).addScaledVector(vb, Math.sin(t * th) / s);
  }
  vc.multiplyScalar(la + (lb - la) * t);
  return vc.toArray(out);
}

function mix(k, a, b, t) {
  if (SHOULDER[k]) {
    const s = SHOULDER[k];
    const ra = [a[0] - s[0], a[1] - s[1], a[2] - s[2]];
    const rb = [b[0] - s[0], b[1] - s[1], b[2] - s[2]];
    const r = slerpDir(ra, rb, t, []);
    return [r[0] + s[0], r[1] + s[1], r[2] + s[2]];
  }
  if (k === 'bladeR' || k === 'faceL') return slerpDir(a, b, t, []);
  return a.map((v, i) => v + (b[i] - v) * t);
}

// keys: [[time, pose, ease]] (time ascending, any unit). Returns the pose at `time`.
export function sampleClip(keys, time, span = keys[keys.length - 1][0]) {
  const out = {};
  for (const k of KEYS) {
    const tk = time + (LAG[k] || 0) * span;
    let i = 0;
    while (i < keys.length - 2 && tk >= keys[i + 1][0]) i++;
    const [t0, p0] = keys[i];
    const [t1, p1, ease] = keys[Math.min(i + 1, keys.length - 1)];
    const u = t1 === t0 ? 1 : Math.max(0, Math.min(1, (tk - t0) / (t1 - t0)));
    out[k] = mix(k, p0[k], p1[k], (EASE[ease] || EASE.inout)(u));
  }
  return out;
}

// Push a pose's sword hand a little further round the shoulder (wind-up coil, follow-through).
// Furthest a hand can be from its shoulder (upper arm + forearm + grip, a little short of locked).
const MAX_REACH = 0.62;
function clampReach(k, hand) {
  const s = SHOULDER[k];
  const d = [hand[0] - s[0], hand[1] - s[1], hand[2] - s[2]];
  const l = Math.hypot(d[0], d[1], d[2]);
  if (l <= MAX_REACH) return hand;
  const f = MAX_REACH / l;
  return [s[0] + d[0] * f, s[1] + d[1] * f, s[2] + d[2] * f];
}

function extend(p, from, amount) {
  const q = pose(p);
  q.handR = clampReach('handR', mix('handR', from.handR, p.handR, 1 + amount));
  q.bladeR = slerpDir(from.bladeR, p.bladeR, 1 + amount * 0.8, []);
  q.chest = add(p.chest, [0, (p.chest[1] - from.chest[1]) * amount, 0]);
  return q;
}

// How a weapon moves. Heavy: deep coil, big lean, a follow-through that drags the
// body round. Quick: short coil, hands close, snapping back. Formal: the sword.
export const STYLES = {
  formal: { coil: 0.2, follow: 0.3, lean: 1, drop: 0.05, followMs: 200, settleMs: 420 },
  heavy: { coil: 0.36, follow: 0.5, lean: 1.35, drop: 0.09, followMs: 260, settleMs: 560 },
  quick: { coil: 0.08, follow: 0.14, lean: 0.75, drop: 0.03, followMs: 160, settleMs: 300 },
};
export const styleFor = (weapon) => (weapon === 'axe' || weapon === 'greataxe' ? 'heavy' : weapon === 'falchion' ? 'quick' : 'formal');

// The marks for one blow, with weight shifts: back onto the rear foot to load, over the front foot to strike.
export function swingMarks(guard, dir, style = 'formal') {
  const S = STYLES[style] || STYLES.formal;
  const [w, s] = SWINGS[dir] || SWINGS.S;
  const wind = pose(guard, w);
  wind.pelvis = add(wind.pelvis, [0, 0.015, -0.09 * S.lean]);
  wind.chest = wind.chest.map((v) => v * S.lean);
  const coil = extend(wind, guard, S.coil);
  coil.pelvis = add(coil.pelvis, [0, 0.01, -0.05 * S.lean]);
  const anticip = pose(guard, { pelvis: add(guard.pelvis, [0, -0.025, 0.03]), chest: add(guard.chest, [0.07, 0, 0]) });
  const hit = pose(guard, s);
  // The shield comes down with the lean, rather than riding up over his head.
  if (!s.handL) hit.handL = add(guard.handL, [0, -0.16 * S.lean, 0.08]);
  hit.pelvis = add(hit.pelvis, [0, -S.drop, 0.13 * S.lean]);
  hit.pelvisRot = add(hit.pelvisRot, [0.08 * S.lean, 0, 0]);
  hit.chest = hit.chest.map((v) => v * S.lean);
  const follow = extend(hit, wind, S.follow);
  follow.pelvis = add(hit.pelvis, [0, -0.01 * S.lean, 0.03 * S.lean]);
  // A level or downward cut never rises again in its follow-through.
  if (hit.bladeR[1] <= wind.bladeR[1] && follow.bladeR[1] > hit.bladeR[1]) {
    const b = follow.bladeR;
    b[1] = hit.bladeR[1];
    const l = Math.hypot(b[0], b[1], b[2]) || 1;
    follow.bladeR = b.map((x) => x / l);
  }
  return { anticip, wind, coil, hit, follow };
}

// Enemy wind-up across its telegraph (u: 0..1).
// The wind-up is quick to its mark, then coils further and holds: a readable silhouette
// and a beat of stillness before the release.
export function windupPose(guard, dir, u, style) {
  const m = swingMarks(guard, dir, style);
  return sampleClip([[0, guard], [0.12, m.anticip, 'inout'], [0.45, m.wind, 'out'], [0.8, m.coil, 'inout'], [1, m.coil, 'linear']], u, 1);
}

// Enemy blow, `ms` after the moment of impact (it was released ~110 ms earlier on screen).
export function strikePose(guard, dir, ms, style) {
  const m = swingMarks(guard, dir, style);
  const S = STYLES[style] || STYLES.formal;
  return sampleClip([[0, m.coil], [110, m.hit, 'snap'], [S.followMs, m.follow, 'out'], [S.settleMs, m.follow, 'linear']], ms, S.settleMs);
}

// Settling into the open, winded stance after a combo.
export function recoverPose(guard, dir, ms, style) {
  const m = swingMarks(guard, dir, style);
  const open = pose(guard, STATES.open);
  return sampleClip([[0, m.follow], [380, open, 'inout'], [800, open, 'linear']], ms, 800);
}

// Shield bash: the shield drawn back and low, then driven forward with the whole body.
export function bashPose(guard, phase, u) {
  const back = pose(guard, {
    pelvis: add(guard.pelvis, [0, -0.08, -0.12]), pelvisRot: [0.12, 0.35, 0], chest: [0.3, 0.45, 0],
    handL: [0.34, 1.05, -0.05], faceL: [0.4, 0, 1], poleL: [1, -0.6, -0.3],
    handR: [-0.38, 1.0, -0.2], bladeR: [-0.2, -0.6, -0.7],
  });
  const drive = pose(guard, {
    pelvis: add(guard.pelvis, [0, -0.1, 0.22]), pelvisRot: [0.2, -0.15, 0], chest: [0.42, -0.2, 0],
    handL: [0.05, 1.28, 0.82], faceL: [0, 0.1, 1], poleL: [1, -0.4, -0.3],
    handR: [-0.42, 1.05, -0.1], bladeR: [-0.3, -0.5, -0.7], footL: [0.17, 0.62, 0.2],
  });
  if (phase === 'wind') return sampleClip([[0, guard], [0.5, back, 'out'], [1, back, 'linear']], u, 1);
  return sampleClip([[0, back], [110, drive, 'snap'], [420, drive, 'linear']], u, 420);
}

// His challenge as he arrives (ms since it began).
export function tauntPose(guard, kind, ms) {
  switch (kind) {
    case 'bang': {
      // Axe haft beaten on the shield, three times.
      const beat = Math.abs(Math.sin((ms / 260) * Math.PI));
      return pose(guard, {
        handR: [-0.05, 1.25 + beat * 0.3, 0.42 - beat * 0.1], bladeR: [0.6, 0.6, 0.3], handL: [0.14, 1.15, 0.42],
        faceL: [0.1, 0, 1], chest: [0.15, 0.2, 0],
      });
    }
    case 'salute':
      return pose(guard, {
        handR: [-0.05, 1.5, 0.28], bladeR: [0, 1, 0.05], chest: [-0.05, 0, 0], pelvis: [0, 0.97, 0],
        footL: [0.12, 0.05, 0.1], footR: [-0.12, -0.05, -0.1],
      });
    case 'point':
      return pose(guard, {
        handR: [-0.2, 1.38, 0.56], bladeR: [0.05, 0.08, 1], chest: [0.1, -0.35, 0], pelvisRot: [0, -0.35, 0],
      });
    case 'raise':
      return pose(guard, {
        handR: [-0.22, 2.05, 0.1], bladeR: [0.05, 1, 0.1], chest: [-0.25, 0, 0], pelvis: [0, 0.98, 0],
      });
    case 'laugh':
      return pose(guard, STATES.roar);
    default:
      return guard;
  }
}

// Your knight's swing (dir already mirrored into his frame). Null when finished.
// Timed to the game: the blade reaches him at 85 ms (CONFIG.player.contactMs) and the
// arm is free again at 250 ms (CONFIG.player.attackMs).
export function playerSwingPose(guard, dir, ms) {
  if (ms > 250) return null;
  const m = swingMarks(guard, dir);
  const keep = (p) => { const q = pose(p); q.footL = guard.footL.slice(); q.footR = guard.footR.slice(); return q; };
  return sampleClip([[0, guard], [40, keep(m.coil), 'out'], [85, keep(m.hit), 'snap'], [150, keep(m.follow), 'out'], [250, guard, 'inout']], ms, 250);
}

// ---------- the animator ----------

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const mx = new THREE.Matrix4();
const ax = new THREE.Vector3();
const ay = new THREE.Vector3();
const az = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const euler = new THREE.Euler();

export class Animator {
  constructor(knight, guard) {
    this.k = knight;
    this.cur = pose(guard);
    this.vel = {};
    for (const key of KEYS) this.vel[key] = [0, 0, 0];
    this.target = pose(guard);
    this.omega = 10;
    this.lift = { L: 0, R: 0 };
    this.hit = { p: 0, y: 0, r: 0, vp: 0, vy: 0, vr: 0 };
    this.headHit = { p: 0, y: 0, vp: 0, vy: 0 };
  }

  set(target, omega = 10) {
    this.target = target;
    this.omega = omega;
  }

  snap(target) {
    this.target = target;
    this.cur = pose(target);
  }

  // Knock the torso (a spring that settles back): directional hit reactions.
  jolt(p, y = 0, r = 0, hp = 0, hy = 0) {
    this.hit.vp += p;
    this.hit.vy += y;
    this.hit.vr += r;
    this.headHit.vp += hp;
    this.headHit.vy += hy;
  }

  // Exact critically damped springs (stable at any frame time); clips set the
  // shape of a move, the springs only smooth hand-offs between them.
  update(dt) {
    if (dt <= 0) return;
    const w = this.omega;
    const e = Math.exp(-w * dt);
    for (const key of KEYS) {
      const c = this.cur[key];
      const v = this.vel[key];
      const t = this.target[key];
      for (let i = 0; i < 3; i++) {
        const y = c[i] - t[i];
        const tv = v[i] + w * y;
        c[i] = t[i] + (y + tv * dt) * e;
        v[i] = (v[i] - w * tv * dt) * e;
      }
    }
    for (const s of ['L', 'R']) {
      const fv = this.vel[`foot${s}`];
      const speed = Math.hypot(fv[0], fv[1]);
      this.lift[s] += (Math.min(0.12, speed * 0.06) - this.lift[s]) * Math.min(1, dt * 20);
    }
    const h = this.hit;
    for (const [x, v] of [['p', 'vp'], ['y', 'vy'], ['r', 'vr']]) {
      h[v] += (-140 * h[x] - 14 * h[v]) * dt;
      h[x] += h[v] * dt;
    }
    // The head on its own, quicker spring.
    const hh = this.headHit;
    for (const [x, v] of [['p', 'vp'], ['y', 'vy']]) {
      hh[v] += (-260 * hh[x] - 18 * hh[v]) * dt;
      hh[x] += hh[v] * dt;
    }
  }

  // FK for the trunk, IK for legs and arms, wrist and shield, look at `lookAt`.
  apply(lookAt, { breathe = 0, wobble = 0, time = 0 } = {}) {
    const { J, fig, size } = this.k;
    const D = this.k.dims || DIM;
    // Figures with other proportions remap the authored pose onto their own body.
    const c = this.k.mapPose ? this.k.mapPose(this.cur) : this.cur;
    const b = breathe;
    J.pelvis.position.set(c.pelvis[0] + Math.sin(time * 0.0016) * 0.01 * b, c.pelvis[1] + Math.sin(time * 0.0031) * 0.006 * b, c.pelvis[2]);
    J.pelvis.rotation.set(c.pelvisRot[0], c.pelvisRot[1], c.pelvisRot[2] + wobble * Math.sin(time * 0.009) * 0.08, 'YXZ');
    const h = this.hit;
    const cp = c.chest[0] + h.p + Math.sin(time * 0.0031) * 0.012 * b;
    const cy = c.chest[1] + h.y;
    const cr = c.chest[2] + h.r + wobble * Math.sin(time * 0.007) * 0.12;
    J.spine.rotation.set(cp * 0.4, cy * 0.4, cr * 0.4, 'YXZ');
    J.chest.rotation.set(cp * 0.6, cy * 0.6, cr * 0.6, 'YXZ');
    J.neck.rotation.set(0, 0, 0);
    J.head.rotation.set(0, 0, 0);
    // Shoulders shrug as the hands rise above them.
    for (const [s, side] of [['R', -1], ['L', 1]]) {
      const hand = c[`hand${s}`];
      const rise = Math.max(0, Math.min(1, (hand[1] - (c.pelvis[1] + (D.spine + D.chest + D.shY) - 0.01)) / 0.42));
      J[`sh${s}`].position.set(side * (D.shX + rise * 0.015), D.shY + rise * 0.05, 0);
    }
    fig.updateMatrixWorld(true);

    if (lookAt) {
      J.neck.getWorldPosition(tmp);
      tmp2.subVectors(lookAt, tmp);
      J.chest.getWorldQuaternion(qa);
      tmp2.applyQuaternion(qa.invert());
      const yaw = Math.max(-0.9, Math.min(0.9, Math.atan2(tmp2.x, tmp2.z)));
      const pitch = Math.max(-0.5, Math.min(0.5, -Math.atan2(tmp2.y, Math.hypot(tmp2.x, tmp2.z))));
      J.neck.rotation.set(pitch * 0.5, yaw * 0.5, 0, 'YXZ');
      J.head.rotation.set(pitch * 0.5, yaw * 0.5, 0, 'YXZ');
    }
    const hh = this.headHit;
    if (Math.abs(hh.p) + Math.abs(hh.y) > 0.001) {
      J.neck.rotation.x += hh.p * 0.4;
      J.neck.rotation.y += hh.y * 0.4;
      J.head.rotation.x += hh.p * 0.6;
      J.head.rotation.y += hh.y * 0.6;
    }

    // Legs: planted feet, knees forward.
    fig.getWorldQuaternion(qa);
    for (const [s, sign] of [['L', 1], ['R', -1]]) {
      const f = c[`foot${s}`];
      const target = fig.localToWorld(tmp.set(f[0], D.ankle + this.lift[s], f[1]));
      const pole = tmp2.set(Math.sin(f[2]) + sign * 0.15, 0, Math.cos(f[2])).applyQuaternion(qa);
      solveTwoBone(J[`hip${s}`], J[`kn${s}`], D.thigh * size, D.shin * size, target, pole);
      qb.setFromEuler(euler.set(0, f[2], 0)).premultiply(qa);
      setWorldQuat(J[`ft${s}`], qb);
    }

    // Sword arm. The elbow points away from the blade (down, out and back),
    // so the forearm stays square to the sword and the wrist stays natural.
    const reachB = (D.fore + D.grip) * size;
    let target = fig.localToWorld(tmp.fromArray(c.handR));
    ax.fromArray(c.bladeR).normalize().applyQuaternion(qa);
    // The elbow goes opposite the part of the blade that crosses the arm line,
    // so the forearm sits square to the sword. When the blade runs along the
    // arm (end of a cut, a thrust) the elbow simply drops down and out.
    J.shR.getWorldPosition(ay);
    ay.subVectors(target, ay).normalize();
    az.copy(ax).addScaledVector(ay, -ax.dot(ay));
    const across = az.length();
    const fallback = tmp2.set(-0.6, -0.8, -0.2).applyQuaternion(qa);
    fallback.addScaledVector(ay, -fallback.dot(ay)).normalize();
    if (across > 0.3) az.normalize().negate().lerp(fallback, 0.3).normalize();
    else az.copy(fallback).lerp(az.normalize().negate(), across / 0.3 * 0.5).normalize();
    solveTwoBone(J.shR, J.elR, D.upper * size, reachB, target, az);
    bendWrist(J.haR, ax, 1.35);

    // Shield arm: hand to its mark, shield face turned toward `faceL`, top kept up.
    // The mark turns with the trunk (a shield arm is carried round by the body).
    const yawT = c.chest[1] * 0.8;
    const hx = c.handL[0] - c.pelvis[0];
    const hz = c.handL[2] - c.pelvis[2];
    target = fig.localToWorld(tmp.set(
      c.pelvis[0] + hx * Math.cos(yawT) + hz * Math.sin(yawT), c.handL[1], c.pelvis[2] - hx * Math.sin(yawT) + hz * Math.cos(yawT),
    ));
    const pole = tmp2.fromArray(c.poleL).normalize().applyQuaternion(qa);
    solveTwoBone(J.shL, J.elL, D.upper * size, reachB, target, pole);
    az.fromArray(c.faceL).normalize().applyQuaternion(qa);
    ay.copy(UP).addScaledVector(az, -az.y).normalize();
    ax.crossVectors(ay, az).normalize();
    ay.crossVectors(az, ax);
    mx.makeBasis(ax, ay, az);
    qb.setFromRotationMatrix(mx);
    setWorldQuat(J.gripL, qb);
  }
}
