import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { DIM, solveTwoBone, aimJoint, setWorldQuat } from './Knight.js';

// Poses are authored in figure space (metres, figure facing +z, his right
// hand on -x): where the hands go, which way the blade points, where the feet
// stand, how the hips and chest turn. Springs carry the figure between poses
// and IK turns them into joint rotations, so every pose keeps its feet planted.

export const KEYS = ['pelvis', 'pelvisRot', 'chest', 'footL', 'footR', 'handR', 'bladeR', 'poleR', 'handL', 'faceL', 'poleL'];

const base = (o) => o;
export const pose = (from, over = {}) => {
  const p = {};
  for (const k of KEYS) p[k] = (over[k] || from[k]).slice();
  return p;
};

// ---------- guards ----------

export const GUARD = {
  // Sword (or axe) and shield: left side leading, weapon up, shield forward.
  ss: base({
    pelvis: [0, 0.95, 0], pelvisRot: [0, -0.22, 0], chest: [0.05, 0.16, 0],
    footL: [0.17, 0.17, 0.3], footR: [-0.19, -0.2, -0.35],
    handR: [-0.32, 1.2, 0.3], bladeR: [0.12, 0.86, 0.5], poleR: [-1, -0.7, -0.3],
    handL: [0.16, 1.2, 0.36], faceL: [0.05, 0.05, 1], poleL: [1, -0.8, -0.2],
  }),
  // The Green Knight: wide A-frame, arms held out from the body, axe hanging.
  giant: base({
    pelvis: [0, 0.98, 0], pelvisRot: [0, 0, 0], chest: [-0.06, 0, 0],
    footL: [0.31, 0.06, 0.18], footR: [-0.31, -0.06, -0.18],
    handR: [-0.47, 1.0, 0.14], bladeR: [0.18, -0.94, 0.28], poleR: [-1, -0.2, -0.6],
    handL: [0.47, 1.0, 0.12], faceL: [0.3, 0, 1], poleL: [1, -0.2, -0.6],
  }),
  // Your knight, after the reference art: a deep lunge, point raised at the foe, shield across.
  hero: base({
    pelvis: [0, 0.86, 0.05], pelvisRot: [0.12, -0.15, 0], chest: [0.16, 0.1, 0],
    footL: [0.2, 0.42, 0.15], footR: [-0.21, -0.46, -0.32],
    handR: [-0.2, 1.24, 0.52], bladeR: [0.04, 0.62, 0.8], poleR: [-1, -0.9, -0.2],
    handL: [0.17, 1.18, 0.4], faceL: [-0.12, 0, 1], poleL: [1, -0.8, -0.2],
  }),
};

// ---------- attacks: [wind-up, strike] overrides, by direction of travel ----------
// E = the blade travels toward the figure's +x (his left): a forehand from his right.

export const SWINGS = {
  S: [
    { handR: [-0.12, 1.98, -0.05], bladeR: [0, 0.25, -1], poleR: [-1, 0.4, 0], chest: [-0.24, -0.1, 0], pelvis: [0, 0.97, -0.05] },
    { handR: [0.0, 1.0, 0.6], bladeR: [0, -0.6, 0.8], poleR: [-1, -0.5, 0], chest: [0.42, 0, 0], pelvis: [0, 0.86, 0.14], footL: [0.17, 0.44, 0.25] },
  ],
  E: [
    { handR: [-0.62, 1.5, -0.02], bladeR: [-0.85, 0.35, -0.4], poleR: [-0.3, -1, -0.3], chest: [0, -0.78, 0], pelvisRot: [0, -0.5, 0] },
    { handR: [0.44, 1.2, 0.48], bladeR: [0.95, -0.05, 0.3], poleR: [-0.2, -1, 0.2], chest: [0.15, 0.68, 0], pelvisRot: [0, 0.28, 0], pelvis: [0, 0.9, 0.1], footL: [0.2, 0.42, 0.2] },
  ],
  W: [
    { handR: [0.32, 1.56, 0.06], bladeR: [0.85, 0.4, -0.35], poleR: [-0.4, -1, 0.5], chest: [0, 0.58, 0] },
    { handR: [-0.64, 1.2, 0.42], bladeR: [-0.95, -0.05, 0.3], poleR: [-1, -0.6, 0], chest: [0.15, -0.62, 0], pelvis: [0, 0.9, 0.1] },
  ],
  SE: [
    { handR: [-0.45, 1.92, 0.0], bladeR: [-0.55, 0.7, -0.45], poleR: [-1, 0, -0.2], chest: [-0.15, -0.52, 0] },
    { handR: [0.36, 0.98, 0.52], bladeR: [0.7, -0.6, 0.4], poleR: [-0.3, -1, 0], chest: [0.36, 0.5, 0], pelvis: [0, 0.87, 0.1] },
  ],
  SW: [
    { handR: [0.25, 1.9, 0.02], bladeR: [0.55, 0.7, -0.45], poleR: [-0.3, -0.4, 1], chest: [-0.15, 0.46, 0] },
    { handR: [-0.56, 0.98, 0.46], bladeR: [-0.7, -0.6, 0.4], poleR: [-1, -0.6, 0], chest: [0.36, -0.5, 0], pelvis: [0, 0.87, 0.1] },
  ],
  T: [
    { handR: [-0.36, 1.15, -0.2], bladeR: [0.05, 0.08, 1], poleR: [-0.6, -0.4, -1], chest: [0, -0.58, 0], pelvisRot: [0, -0.42, 0] },
    { handR: [-0.05, 1.32, 0.72], bladeR: [0, 0.05, 1], poleR: [-1, -0.4, 0], chest: [0.16, 0.25, 0], pelvis: [0, 0.84, 0.3], footL: [0.18, 0.64, 0.2] },
  ],
  N: [
    { handR: [-0.35, 0.86, 0.26], bladeR: [-0.4, -0.75, 0.4], poleR: [-1, -0.2, -0.2], chest: [0.26, -0.3, 0] },
    { handR: [0.0, 1.96, 0.36], bladeR: [0.1, 0.8, 0.5], poleR: [-1, 0.2, 0], chest: [-0.16, 0.2, 0] },
  ],
  NE: [
    { handR: [-0.46, 0.9, 0.3], bladeR: [-0.6, -0.6, 0.4], poleR: [-1, -0.3, -0.2], chest: [0.2, -0.45, 0] },
    { handR: [0.35, 1.86, 0.36], bladeR: [0.6, 0.7, 0.3], poleR: [-0.4, -0.6, 0.6], chest: [-0.12, 0.45, 0] },
  ],
  NW: [
    { handR: [0.3, 0.9, 0.36], bladeR: [0.6, -0.6, 0.4], poleR: [-0.3, -1, 0.3], chest: [0.2, 0.4, 0] },
    { handR: [-0.5, 1.86, 0.3], bladeR: [-0.6, 0.7, 0.3], poleR: [-1, 0, -0.2], chest: [-0.12, -0.45, 0] },
  ],
};

export const STATES = {
  open: { handR: [-0.4, 0.95, 0.3], bladeR: [0.1, -0.8, 0.6], chest: [0.26, 0, 0], pelvis: [0, 0.9, 0], handL: [0.32, 1.0, 0.24], faceL: [0.3, -0.3, 1] },
  parried: { handR: [-0.56, 1.9, -0.35], bladeR: [-0.4, 0.6, -0.7], chest: [-0.36, -0.3, 0.1], pelvis: [0, 0.96, -0.16], handL: [0.4, 1.32, 0.1] },
  staggered: {
    pelvis: [0, 0.8, -0.12], pelvisRot: [0.12, 0.22, 0.16], chest: [-0.36, 0.32, 0.26],
    handR: [-0.62, 0.95, 0.05], bladeR: [-0.4, -0.8, 0.3], handL: [0.56, 1.05, -0.05], faceL: [0.6, -0.4, 0.6],
    footL: [0.26, 0.05, 0.4], footR: [-0.25, -0.26, -0.3],
  },
  roar: {
    chest: [-0.36, 0, 0], pelvis: [0, 1.0, 0], handR: [-0.76, 1.76, 0.16], bladeR: [-0.3, 0.9, 0.1],
    handL: [0.76, 1.76, 0.16], faceL: [0.7, 0.3, 0.5], footL: [0.32, 0.05, 0], footR: [-0.32, -0.05, 0],
  },
  kneel: {
    pelvis: [0, 0.55, 0.1], pelvisRot: [0.1, 0, 0], chest: [0.45, 0, 0], footR: [-0.18, -0.48, 0], footL: [0.18, 0.3, 0],
    handR: [-0.32, 0.62, 0.38], bladeR: [0, -1, 0.15], handL: [0.3, 0.72, 0.22], faceL: [0.2, -0.5, 1],
  },
  collapse: {
    pelvis: [0.12, 0.3, 0.2], pelvisRot: [0.3, 0, 1.15], chest: [0.8, 0, 0.4], footR: [-0.18, -0.48, 0], footL: [0.18, 0.3, 0],
    handR: [-0.5, 0.3, 0.4], bladeR: [-0.2, -0.3, 1], handL: [0.4, 0.3, 0.1], faceL: [0, -1, 0.2],
  },
  block: {
    handL: [0.02, 1.42, 0.46], faceL: [0, 0.1, 1], poleL: [1, -0.4, -0.2], handR: [-0.36, 1.0, 0.16], bladeR: [-0.1, 0.6, 0.75],
    chest: [0.26, 0.05, 0], pelvis: [0, 0.8, 0.02],
  },
  stun: { chest: [-0.36, 0, 0.12], pelvis: [0, 0.88, -0.16], handR: [-0.52, 1.05, 0.1], bladeR: [-0.3, 0.4, 0.8], handL: [0.42, 1.05, 0.15] },
  dead: {
    pelvis: [0, 0.38, -0.32], pelvisRot: [-1.15, 0, 0.1], chest: [-0.3, 0, 0], handR: [-0.62, 0.4, -0.25], bladeR: [-0.5, 0, 0.8],
    handL: [0.62, 0.4, -0.25], faceL: [0.4, 1, 0],
  },
};

// Seen from behind, your swipe's screen direction is mirrored in your knight's own frame.
const MIRROR = { E: 'W', W: 'E', NE: 'NW', NW: 'NE', SE: 'SW', SW: 'SE', N: 'N', S: 'S', T: 'T' };
export const mirrorDir = (d) => MIRROR[d] || d;

// ---------- the animator ----------

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const mx = new THREE.Matrix4();
const ax = new THREE.Vector3();
const ay = new THREE.Vector3();
const az = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);

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
  }

  set(target, omega = 10) {
    this.target = target;
    this.omega = omega;
  }

  snap(target) {
    this.target = target;
    this.cur = pose(target);
  }

  // Knock the torso (spring that settles back): hit reactions.
  jolt(p, y = 0, r = 0) {
    this.hit.vp += p;
    this.hit.vy += y;
    this.hit.vr += r;
  }

  // Exact critically damped springs: stable at any frame time.
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
        const tmpv = v[i] + w * y;
        c[i] = t[i] + (y + tmpv * dt) * e;
        v[i] = (v[i] - w * tmpv * dt) * e;
      }
    }
    // Feet lift while they travel.
    for (const s of ['L', 'R']) {
      const fv = this.vel[`foot${s}`];
      const speed = Math.hypot(fv[0], fv[1]);
      this.lift[s] += (Math.min(0.12, speed * 0.05) - this.lift[s]) * Math.min(1, dt * 20);
    }
    // Hit spring
    const h = this.hit;
    const k = 140;
    const d = 14;
    for (const [x, v] of [['p', 'vp'], ['y', 'vy'], ['r', 'vr']]) {
      h[v] += (-k * h[x] - d * h[v]) * dt;
      h[x] += h[v] * dt;
    }
  }

  // FK for the trunk, IK for legs and arms, aim weapon and shield, look at `lookAt`.
  apply(lookAt, { breathe = 0, wobble = 0, time = 0 } = {}) {
    const { J, fig, size } = this.k;
    const c = this.cur;
    const sway = Math.sin(time * 0.0016) * 0.01 * breathe;
    J.pelvis.position.set(c.pelvis[0] + sway, c.pelvis[1] + Math.sin(time * 0.0031) * 0.006 * breathe, c.pelvis[2]);
    J.pelvis.rotation.set(c.pelvisRot[0], c.pelvisRot[1], c.pelvisRot[2] + wobble * Math.sin(time * 0.009) * 0.08, 'YXZ');
    const h = this.hit;
    const cp = c.chest[0] + h.p + Math.sin(time * 0.0031) * 0.012 * breathe;
    const cy = c.chest[1] + h.y;
    const cr = c.chest[2] + h.r + wobble * Math.sin(time * 0.007) * 0.12;
    J.spine.rotation.set(cp * 0.4, cy * 0.4, cr * 0.4, 'YXZ');
    J.chest.rotation.set(cp * 0.6, cy * 0.6, cr * 0.6, 'YXZ');
    J.neck.rotation.set(0, 0, 0);
    J.head.rotation.set(0, 0, 0);
    fig.updateMatrixWorld(true);

    // Head turns to watch the opponent.
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

    // Legs: planted feet, knees forward.
    fig.getWorldQuaternion(qa);
    for (const [s, sign] of [['L', 1], ['R', -1]]) {
      const f = c[`foot${s}`];
      const target = fig.localToWorld(tmp.set(f[0], DIM.ankle + this.lift[s], f[1]));
      const pole = tmp2.set(Math.sin(f[2]) + sign * 0.15, 0, Math.cos(f[2])).applyQuaternion(qa);
      solveTwoBone(J[`hip${s}`], J[`kn${s}`], DIM.thigh * size, DIM.shin * size, target, pole);
      qb.setFromEuler(new THREE.Euler(0, f[2], 0)).premultiply(qa);
      setWorldQuat(J[`ft${s}`], qb);
    }

    // Sword arm: hand to its mark, blade aimed.
    const reachB = (DIM.fore + DIM.grip) * size;
    let target = fig.localToWorld(tmp.fromArray(c.handR));
    let pole = tmp2.fromArray(c.poleR).normalize().applyQuaternion(qa);
    solveTwoBone(J.shR, J.elR, DIM.upper * size, reachB, target, pole);
    aimJoint(J.gripR, DOWN, tmp.fromArray(c.bladeR).normalize().applyQuaternion(qa));

    // Shield arm: hand to its mark, shield face turned toward `faceL`, top kept up.
    target = fig.localToWorld(tmp.fromArray(c.handL));
    pole = tmp2.fromArray(c.poleL).normalize().applyQuaternion(qa);
    solveTwoBone(J.shL, J.elL, DIM.upper * size, reachB, target, pole);
    az.fromArray(c.faceL).normalize().applyQuaternion(qa);
    ay.copy(UP).addScaledVector(az, -az.y).normalize();
    ax.crossVectors(ay, az).normalize();
    ay.crossVectors(az, ax);
    mx.makeBasis(ax, ay, az);
    qb.setFromRotationMatrix(mx);
    setWorldQuat(J.gripL, qb);
  }
}
