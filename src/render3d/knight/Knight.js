import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';
import { figureMaterials, shieldTex } from './Mat.js';

// A knight is a skeleton of joints carrying rigid armour plates (armour is
// rigid, so rigid parts per joint look right). Low-poly and flat-shaded: the
// silhouette carries the look. Limbs hang along -y; the figure faces +z.
//
// Period reference for the knights: English harness c.1370-1400 (the Black
// Prince's effigy, the Churburg armour, Gawain's arming in the poem): bascinet
// with mail aventail, fitted heraldic jupon with a dagged hem, jewelled hip
// belt, small laminated spaudlers with besagews, couters and poleyns with side
// wings, hourglass gauntlets, pointed laminated sabatons.

export const DIM = {
  pelvisY: 1.0, spine: 0.12, chest: 0.2, neck: 0.2, head: 0.09,
  shX: 0.2, shY: 0.17, upper: 0.3, fore: 0.27, grip: 0.085,
  hipX: 0.11, hipY: -0.06, thigh: 0.46, shin: 0.4, ankle: 0.08,
};

const COL = {
  gold: '#d4a13a', leather: '#5a3a24', wood: '#7a5434', black: '#0a0807', iron: '#3a3634',
};

const V = (x, y) => new THREE.Vector2(x, y);
const lathe = (pts, segs = 10, phiStart = 0, phiLen = Math.PI * 2) => new THREE.LatheGeometry(pts.map(([r, y]) => V(r, y)), segs, phiStart, phiLen);
const cyl = (rt, rb, h, segs = 8, open = false, ts = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(rt, rb, h, segs, 1, open, ts, tl);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ball = (r, w = 8, h = 6, ...rest) => new THREE.SphereGeometry(r, w, h, ...rest);

function extrude(points, depth, bevel = 0.005) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else s.lineTo(p[0], p[1]);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Collects parts per joint and material, bakes colours into vertices, merges.
class PartBag {
  constructor(M) {
    this.M = M;
    this.byJoint = new Map();
  }

  add(joint, geo, mat, color = null, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (this.M[mat].vertexColors) {
      const c = new THREE.Color(color || '#ffffff');
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    g.clearGroups();
    if (!this.byJoint.has(joint)) this.byJoint.set(joint, new Map());
    const bucket = this.byJoint.get(joint);
    if (!bucket.has(mat)) bucket.set(mat, []);
    bucket.get(mat).push(g);
  }

  build() {
    for (const [joint, bucket] of this.byJoint) {
      for (const [mat, geos] of bucket) {
        const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        const mesh = new THREE.Mesh(merged, this.M[mat]);
        mesh.castShadow = true;
        joint.add(mesh);
      }
    }
    this.byJoint.clear();
  }
}

function joint(name, parent, x, y, z) {
  const j = new THREE.Object3D();
  j.name = name;
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

// ---------- heads ----------

function face(bag, head, L) {
  bag.add(head, ball(0.1, 10, 8), 'matte', L.skin, [0, 0.1, 0], [0, 0, 0], [0.95, 1.15, 1.05]);
  bag.add(head, box(0.028, 0.048, 0.035), 'matte', L.skin, [0, 0.1, 0.105]);
  [-1, 1].forEach((s) => {
    bag.add(head, box(0.022, 0.014, 0.01), 'matte', COL.black, [s * 0.036, 0.128, 0.097]);
    bag.add(head, box(0.04, 0.012, 0.015), 'matte', L.beard || '#4a3020', [s * 0.038, 0.148, 0.097], [0, 0, s * -0.2]);
  });
  if (L.beard) {
    bag.add(head, ball(0.105, 10, 6, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), 'matte', L.beard, [0, 0.085, 0.012], [0, 0, 0], [1, 1.4, 1.05]);
    bag.add(head, box(0.075, 0.018, 0.02), 'matte', L.beard, [0, 0.07, 0.102]);
  }
}

function helm(bag, head, L) {
  const steel = L.helmColor || L.plate;
  switch (L.helm) {
    case 'bascinet': {
      // Pointed bascinet with a snouted "hounskull" visor, mail aventail, plume.
      bag.add(head, lathe([[0, 0.31], [0.035, 0.29], [0.095, 0.22], [0.125, 0.13], [0.128, 0.04], [0.122, -0.01], [0, -0.01]]), 'metal', steel, [0, 0, 0], [0, 0, 0], [1, 1, 1.08]);
      bag.add(head, ball(0.108, 10, 6), 'metal', steel, [0, 0.1, 0.035], [0, 0, 0], [1.06, 1, 1]);
      bag.add(head, new THREE.ConeGeometry(0.095, 0.16, 8), 'metal', steel, [0, 0.1, 0.15], [Math.PI / 2, 0, 0], [1.1, 1, 0.82]);
      [-1, 1].forEach((s) => bag.add(head, box(0.045, 0.012, 0.03), 'matte', COL.black, [s * 0.042, 0.13, 0.16], [0, s * 0.45, 0]));
      for (let i = 0; i < 3; i++) bag.add(head, box(0.01, 0.01, 0.03), 'matte', COL.black, [0.035, 0.085 - i * 0.017, 0.19]);
      bag.add(head, cyl(0.129, 0.129, 0.02, 10, true), 'metal', COL.gold, [0, 0.01, 0], [0, 0, 0], [1, 1, 1.08]);
      bag.add(head, cyl(0.13, 0.21, 0.18, 10, true), 'mail', null, [0, -0.08, -0.01]);
      bag.add(head, new THREE.ConeGeometry(0.045, 0.32, 6), 'matte', L.crest, [0, 0.38, -0.08], [-1.15, 0, 0]);
      break;
    }
    case 'nasal':
      face(bag, head, L);
      bag.add(head, lathe([[0, 0.3], [0.04, 0.28], [0.1, 0.2], [0.122, 0.14], [0.124, 0.1], [0, 0.1]], 8), 'metal', steel, [0, 0, 0], [0, 0, 0], [1, 1, 1.08]);
      bag.add(head, cyl(0.126, 0.126, 0.03, 8, true), 'metal', COL.gold, [0, 0.11, 0], [0, 0, 0], [1, 1, 1.08]);
      bag.add(head, box(0.026, 0.11, 0.02), 'metal', steel, [0, 0.07, 0.135]);
      bag.add(head, cyl(0.11, 0.15, 0.12, 8, true), 'mail', null, [0, 0.02, -0.02]);
      break;
    case 'hood':
      face(bag, head, L);
      bag.add(head, ball(0.15, 10, 8, Math.PI / 2 + 0.7, Math.PI * 2 - 1.4, 0, Math.PI * 0.72), 'matte', L.helmColor, [0, 0.1, -0.01], [0, 0, 0], [1, 1.12, 1.05]);
      bag.add(head, cyl(0.15, 0.22, 0.12, 10), 'matte', L.helmColor, [0, -0.03, -0.01]);
      bag.add(head, new THREE.ConeGeometry(0.05, 0.26, 6), 'matte', L.helmColor, [0, 0.14, -0.17], [-1.95, 0, 0]);
      break;
    case 'antler':
      bag.add(head, lathe([[0, 0.34], [0.1, 0.33], [0.14, 0.27], [0.145, 0.12], [0.145, -0.02], [0.132, -0.06], [0, -0.06]]), 'metal', steel, [0, 0, 0], [0, 0, 0], [1, 1, 1.06]);
      bag.add(head, box(0.22, 0.02, 0.03), 'matte', COL.black, [0, 0.15, 0.146]);
      bag.add(head, box(0.02, 0.13, 0.03), 'matte', COL.black, [0, 0.07, 0.148]);
      antlers(bag, head, L);
      break;
    case 'greathelm':
    default:
      bag.add(head, lathe([[0, 0.29], [0.1, 0.285], [0.128, 0.26], [0.134, 0.15], [0.134, 0], [0.14, -0.05], [0, -0.05]]), 'metal', steel, [0, 0, 0], [0, 0, 0], [1, 1, 1.06]);
      bag.add(head, box(0.23, 0.022, 0.03), 'matte', COL.black, [0, 0.165, 0.137]);
      bag.add(head, box(0.26, 0.022, 0.03), 'metal', steel, [0, 0.19, 0.137]);
      bag.add(head, box(0.03, 0.22, 0.025), 'metal', COL.gold, [0, 0.07, 0.146]);
      for (let i = 0; i < 4; i++) bag.add(head, box(0.012, 0.012, 0.03), 'matte', COL.black, [-0.06 - (i % 2) * 0.025, 0.08 - Math.floor(i / 2) * 0.03, 0.137]);
      if (L.crest) bag.add(head, cyl(0.15, 0.15, 0.03, 8, false, 0, Math.PI), 'matte', L.crest, [0, 0.29, -0.02], [0, 0, Math.PI / 2]);
      break;
  }
}

function antlers(bag, head, L) {
  const beam = [[0.11, 0.24, 0], [0.18, 0.31, -0.02], [0.26, 0.41, -0.04], [0.31, 0.53, -0.02], [0.34, 0.65, 0.02], [0.4, 0.72, 0]];
  const tines = [
    [[0.18, 0.31, -0.02], [0.2, 0.39, 0.07], [0.19, 0.47, 0.1]],
    [[0.26, 0.41, -0.04], [0.33, 0.47, 0.04], [0.42, 0.51, 0.06]],
    [[0.31, 0.53, -0.02], [0.29, 0.62, 0.03], [0.27, 0.71, 0.01]],
    [[0.34, 0.65, 0.02], [0.32, 0.75, 0.03]],
  ];
  [-1, 1].forEach((s) => {
    const curve = (pts, r) => {
      const c = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x * s, y, z)));
      bag.add(head, new THREE.TubeGeometry(c, 8, r, 5, false), 'matte', L.antler || '#d8cbb0');
    };
    curve(beam, 0.024);
    tines.forEach((t) => curve(t, 0.016));
  });
}

// Antlers on their own (for a borrowed helm): a group with its origin at the
// head joint of the code-built knight (antler bases about 0.24 m above it).
export function antlerCrown(L) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: L.antler || '#d8cbb0', roughness: 0.75, flatShading: true });
  const bag = new PartBag({ matte: mat });
  antlers(bag, g, L);
  bag.build();
  g.userData.mats = [mat];
  return g;
}

// ---------- weapons and shields ----------

// Built with the blade along -y from the grip; a holder turns it to leave the
// fist along the hand's -z (see buildKnight).
export function weapon(kind, M, L) {
  const g = new THREE.Object3D();
  const bag = new PartBag(M);
  let len;
  if (kind === 'axe' || kind === 'greataxe') {
    const big = kind === 'greataxe';
    len = big ? 1.3 : 0.72;
    bag.add(g, cyl(big ? 0.024 : 0.019, big ? 0.028 : 0.022, len + 0.15, 6), 'matte', COL.wood, [0, -len / 2 + 0.1, 0]);
    bag.add(g, cyl(big ? 0.032 : 0.026, big ? 0.032 : 0.026, 0.05, 6), 'metal', COL.iron, [0, 0.16, 0]);
    const hy = -len + 0.12;
    const sc = big ? 1.75 : 1;
    bag.add(g, extrude([[0, 0.06], [0.06, 0.05], [0.16, 0.11, 0.2, 0.12], [0.22, -0.14], [0.14, -0.1, 0.06, -0.06], [0, -0.05]], 0.012, 0.007), 'blade', L.blade, [0.01, hy, 0], [0, 0, 0], [sc, sc, 1]);
    if (big) bag.add(g, extrude([[0, 0.04], [-0.12, 0.08], [-0.16, 0], [-0.12, -0.08], [0, -0.04]], 0.012, 0.007), 'blade', L.blade, [0, hy, 0]);
    bag.add(g, box(0.05, 0.16 * sc, 0.045), 'metal', COL.iron, [0, hy, 0]);
    bag.build();
    return { g, len: len + 0.02 };
  }
  const fal = kind === 'falchion';
  const blade = fal ? 0.66 : 0.86;
  bag.add(g, cyl(0.017, 0.019, 0.15, 6), 'matte', COL.leather, [0, 0.0, 0]);
  bag.add(g, cyl(0.036, 0.036, 0.026, 10), 'metal', COL.gold, [0, 0.095, 0], [0, 0, Math.PI / 2]);
  bag.add(g, box(0.28, 0.024, 0.034), 'metal', COL.gold, [0, -0.08, 0]);
  [-1, 1].forEach((s) => bag.add(g, box(0.03, 0.04, 0.04), 'metal', COL.gold, [s * 0.14, -0.078, 0]));
  const pts = fal
    ? [[-0.025, 0], [0.025, 0], [0.05, -blade * 0.78], [0.05, -blade, -0.03, -blade], [-0.025, -blade * 0.5]]
    : [[-0.028, 0], [0.028, 0], [0.022, -blade * 0.82], [0, -blade], [-0.022, -blade * 0.82]];
  bag.add(g, extrude(pts, 0.004, 0.006), 'blade', L.blade, [0, -0.09, 0]);
  if (!fal) [-1, 1].forEach((s) => bag.add(g, box(0.011, blade * 0.6, 0.004), 'metal', COL.iron, [0, -0.09 - blade * 0.34, s * 0.006]));
  bag.build();
  return { g, len: 0.09 + blade };
}

export function shield(kind, L, M) {
  const g = new THREE.Object3D();
  if (!kind) return g;
  const bag = new PartBag(M);
  if (kind === 'holly') {
    bag.add(g, cyl(0.012, 0.016, 0.55, 5), 'matte', COL.wood, [0, -0.18, 0]);
    for (let i = 0; i < 9; i++) {
      bag.add(g, extrude([[0, 0], [0.03, 0.02], [0.07, 0], [0.03, -0.02]], 0.004, 0), 'matte', '#2f6b2a', [(i % 2 ? 1 : -1) * 0.01, -0.03 - i * 0.05, 0.01], [0, 0, (i % 2 ? 0.4 : Math.PI - 0.4)]);
    }
    bag.build();
    return g;
  }
  const round = kind !== 'heater';
  const faceTex = shieldTex(L.shield || L.tabard, L.shieldCharge ?? L.charge, L.chargeColor, round).clone();
  faceTex.needsUpdate = true;
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.65, envMapIntensity: 0.4, flatShading: true });
  M.extra.push(faceMat);
  if (round) {
    const r = kind === 'buckler' ? 0.16 : 0.28;
    const disk = cyl(r, r, 0.035, 16);
    disk.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(disk, [M.matte, faceMat, M.matte]);
    mesh.castShadow = true;
    g.add(mesh);
    bag.add(g, new THREE.TorusGeometry(r, 0.018, 4, 16), 'metal', COL.gold);
    bag.add(g, ball(r * 0.28, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 'metal', '#b9bec6', [0, 0, 0.018], [Math.PI / 2, 0, 0]);
  } else {
    const outline = [[-0.22, 0.27], [0.22, 0.27], [0.22, 0.0], [0.2, -0.25, 0, -0.37], [-0.2, -0.25, -0.22, 0.0]];
    const face = extrude(outline, 0.03, 0.005);
    faceTex.repeat.set(1 / 0.456, 1 / 0.652);
    faceTex.offset.set(0.228 / 0.456, 0.376 / 0.652);
    const mesh = new THREE.Mesh(face, [faceMat, M.matte]);
    mesh.castShadow = true;
    g.add(mesh);
    bag.add(g, extrude(outline, 0.02, 0.005), 'metal', COL.gold, [0, -0.004, -0.012], [0, 0, 0], [1.06, 1.05, 1]);
  }
  bag.build();
  return g;
}

// ---------- the knight ----------

// The joint hierarchy alone (no meshes). `D` gives bone lengths; skinned
// models get one built to their own proportions and drive their bones from it.
export function buildSkeleton(D = DIM, size = 1) {
  const root = new THREE.Group();
  const fig = joint('fig', root, 0, 0, 0);
  fig.scale.setScalar(size);
  const J = {};
  J.pelvis = joint('pelvis', fig, 0, D.pelvisY, 0);
  J.spine = joint('spine', J.pelvis, 0, D.spine, 0);
  J.chest = joint('chest', J.spine, 0, D.chest, 0);
  J.neck = joint('neck', J.chest, 0, D.neck, 0);
  J.head = joint('head', J.neck, 0, D.head, 0);
  for (const [side, s] of [['R', -1], ['L', 1]]) {
    J[`sh${side}`] = joint(`sh${side}`, J.chest, s * D.shX, D.shY, 0);
    J[`el${side}`] = joint(`el${side}`, J[`sh${side}`], 0, -D.upper, 0);
    J[`ha${side}`] = joint(`ha${side}`, J[`el${side}`], 0, -D.fore, 0);
    J[`grip${side}`] = joint(`grip${side}`, J[`ha${side}`], 0, -D.grip, 0);
    J[`hip${side}`] = joint(`hip${side}`, J.pelvis, s * D.hipX, D.hipY, 0);
    J[`kn${side}`] = joint(`kn${side}`, J[`hip${side}`], 0, -D.thigh, 0);
    J[`ft${side}`] = joint(`ft${side}`, J[`kn${side}`], 0, -D.shin, 0);
  }
  return { root, fig, J };
}

export function buildKnight(look, weaponKind, offhandKind, size = 1) {
  const M = { ...figureMaterials(look), extra: [] };
  const L = { plate: '#c4c9d1', skin: '#e0b090', ...look };
  const P = L.plate;
  const { root, fig, J } = buildSkeleton(DIM, size);
  const bag = new PartBag(M);
  const tab = L.tabard;

  // Hips: dagged jupon skirt, jewelled girdle, mail below.
  bag.add(J.pelvis, cyl(0.205, 0.25, 0.22, 12, true), 'skirt', null, [0, -0.08, 0], [0, 0, 0], [1, 1, 0.8]);
  bag.add(J.pelvis, cyl(0.214, 0.214, 0.045, 12), 'metal', COL.gold, [0, 0.0, 0], [0, 0, 0], [1, 1, 0.8]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    bag.add(J.pelvis, box(0.035, 0.05, 0.012), 'metal', i % 2 ? COL.gold : '#9a2a2a', [Math.sin(a) * 0.216, 0.0, Math.cos(a) * 0.216 * 0.8], [0, a, 0]);
  }
  bag.add(J.pelvis, cyl(0.21, 0.25, 0.1, 12, true), 'mail', null, [0, -0.2, 0], [0, 0, 0], [1, 1, 0.8]);
  bag.add(J.spine, cyl(0.19, 0.205, 0.18, 12), 'matte', tab, [0, 0.0, 0], [0, 0, 0], [1, 1, 0.78]);

  // Chest: rounded, quilted jupon over the breastplate; gorget; spaudler caps; besagews.
  bag.add(J.chest, lathe([[0.19, -0.2], [0.214, -0.09], [0.226, 0.03], [0.212, 0.12], [0.16, 0.17], [0.0, 0.18]], 12, Math.PI), 'jupon', null, [0, 0, 0], [0, 0, 0], [1, 1, 0.78]);
  bag.add(J.chest, cyl(0.11, 0.15, 0.07, 10), 'metal', P, [0, 0.19, 0]);
  bag.add(J.chest, cyl(0.094, 0.112, 0.05, 10), 'metal', P, [0, 0.235, 0]);
  [-1, 1].forEach((s) => {
    bag.add(J.chest, ball(0.095, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 'metal', P, [s * 0.2, 0.17, 0], [0, 0, -s * 0.28], [1.05, 0.62, 1.1]);
    bag.add(J.chest, cyl(0.056, 0.056, 0.014, 8), 'metal', P, [s * 0.165, 0.06, 0.14], [Math.PI / 2 - 0.2, 0, s * 0.3]);
    bag.add(J.chest, cyl(0.016, 0.016, 0.02, 6), 'metal', COL.gold, [s * 0.168, 0.06, 0.15], [Math.PI / 2 - 0.2, 0, s * 0.3]);
  });
  bag.add(J.neck, cyl(0.055, 0.06, 0.12, 8), 'mail', null, [0, 0.0, 0]);
  helm(bag, J.head, L);

  // Arms: laminated spaudlers that ride the arm, rerebrace, couter with fan,
  // vambrace overlapping the elbow, hourglass gauntlet closed round the grip.
  for (const [side] of [['R'], ['L']]) {
    const sh = J[`sh${side}`];
    const el = J[`el${side}`];
    const ha = J[`ha${side}`];
    bag.add(sh, cyl(0.068, 0.064, 0.08, 8), 'mail', null, [0, -0.01, 0]);
    bag.add(sh, cyl(0.079, 0.074, 0.05, 8), 'metal', P, [0, -0.005, 0]);
    bag.add(sh, cyl(0.075, 0.07, 0.05, 8), 'metal', P, [0, -0.048, 0]);
    bag.add(sh, cyl(0.07, 0.06, 0.26, 8), 'metal', P, [0, -0.17, 0]);
    bag.add(el, ball(0.07, 8, 6), 'metal', P, [0, 0, 0.022]);
    bag.add(el, cyl(0.088, 0.088, 0.012, 8, false, 0, Math.PI), 'metal', P, [0, 0, 0.03], [0, Math.PI / 2, Math.PI / 2]);
    bag.add(el, cyl(0.066, 0.053, 0.26, 8), 'metal', P, [0, -0.13, 0]);
    bag.add(ha, cyl(0.078, 0.05, 0.065, 8), 'metal', P, [0, 0.0, 0]);
    bag.add(ha, box(0.085, 0.09, 0.065), 'metal', P, [0, -0.072, 0]);
    bag.add(ha, box(0.09, 0.022, 0.072), 'metal', P, [0, -0.108, 0]);
    bag.add(ha, box(0.08, 0.035, 0.07), 'matte', COL.leather, [0, -0.128, -0.008]);
    bag.add(ha, box(0.03, 0.055, 0.035), 'metal', P, [0, -0.07, -0.045]);
  }

  // Legs: cuisses, poleyns with side wings, greaves, pointed laminated sabatons, spurs.
  for (const [side] of [['R'], ['L']]) {
    const hip = J[`hip${side}`];
    const kn = J[`kn${side}`];
    const ft = J[`ft${side}`];
    bag.add(hip, cyl(0.096, 0.09, 0.08, 8), 'mail', null, [0, -0.03, 0]);
    bag.add(hip, cyl(0.09, 0.07, 0.38, 8), 'metal', P, [0, -0.24, 0.005]);
    bag.add(kn, ball(0.068, 8, 6), 'metal', P, [0, 0, 0.03]);
    [-1, 1].forEach((s) => bag.add(kn, cyl(0.058, 0.058, 0.01, 8, false, 0, Math.PI), 'metal', P, [s * 0.062, 0, 0.0], [0, 0, s * Math.PI / 2]));
    bag.add(kn, cyl(0.066, 0.05, 0.36, 8), 'metal', P, [0, -0.2, 0]);
    bag.add(ft, box(0.1, 0.075, 0.12), 'metal', P, [0, -0.04, 0.02]);
    bag.add(ft, box(0.09, 0.06, 0.08), 'metal', P, [0, -0.05, 0.1], [0.2, 0, 0]);
    bag.add(ft, box(0.075, 0.05, 0.07), 'metal', P, [0, -0.06, 0.16], [0.3, 0, 0]);
    bag.add(ft, new THREE.ConeGeometry(0.034, 0.12, 4), 'metal', P, [0, -0.066, 0.24], [Math.PI / 2, Math.PI / 4, 0]);
    bag.add(ft, box(0.085, 0.06, 0.07), 'matte', COL.leather, [0, -0.045, -0.05]);
    bag.add(ft, cyl(0.022, 0.022, 0.006, 6), 'metal', COL.gold, [0, -0.04, -0.1], [0, 0, Math.PI / 2]);
  }

  if (L.leafy) {
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const rr = 0.22 + (i % 3) * 0.03;
      bag.add(J.chest, extrude([[0, 0], [0.05, 0.03], [0.11, 0], [0.05, -0.03]], 0.01, 0), 'matte', ['#2f6b2a', '#3f8a35', '#557a2a'][i % 3], [Math.cos(a) * rr, 0.16 + (i % 2) * 0.04, Math.sin(a) * rr * 0.8], [0.5, -a, 0.3]);
    }
  }
  bag.build();

  // Weapon leaves the fist on the hand's -z side; shield rides the off hand.
  const w = weapon(weaponKind, M, L);
  const holder = new THREE.Object3D();
  holder.rotation.x = Math.PI / 2;
  holder.add(w.g);
  J.gripR.add(holder);
  const off = shield(offhandKind, L, M);
  J.gripL.add(off);

  const mats = [M.metal, M.blade, M.matte, M.mail, M.jupon, M.skirt, ...M.extra];
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, fig, J, M, weaponObj: w.g, weaponLen: w.len, offhand: off, mats, weaponMats: [M.blade], size };
}

// ---------- inverse kinematics ----------

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _u = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

// Two-bone IK: rotate `upper` and bend `lower` so the chain ends at `target`
// (world), with the middle joint (knee/elbow) pushed toward `pole` (world dir).
export function solveTwoBone(upper, lower, a, b, target, pole) {
  upper.parent.updateWorldMatrix(true, false);
  upper.getWorldPosition(_s);
  _v.subVectors(target, _s);
  const d = Math.min(a + b - 1e-4, Math.max(0.02, _v.length()));
  _v.normalize();
  const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
  const alpha = Math.acos(cosA);
  _w.copy(pole).addScaledVector(_v, -pole.dot(_v));
  if (_w.lengthSq() < 1e-6) _w.set(0, 0, 1).addScaledVector(_v, -_v.z);
  _w.normalize();
  _u.copy(_v).multiplyScalar(Math.cos(alpha)).addScaledVector(_w, Math.sin(alpha)).normalize();
  _y.copy(_u).negate();
  _z.copy(pole).addScaledVector(_u, -pole.dot(_u));
  if (_z.lengthSq() < 1e-6) _z.copy(_w);
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  _z.crossVectors(_x, _y).normalize();
  _m.makeBasis(_x, _y, _z);
  _q.setFromRotationMatrix(_m);
  upper.parent.getWorldQuaternion(_q2);
  upper.quaternion.copy(_q2.invert().multiply(_q));
  const cosB = Math.min(1, Math.max(-1, (a * a + b * b - d * d) / (2 * a * b)));
  lower.quaternion.setFromAxisAngle(_x.set(1, 0, 0), Math.PI - Math.acos(cosB));
  upper.updateWorldMatrix(false, true);
}

// Bend the wrist so the weapon (which leaves the fist along the hand's -z)
// points along `dir`, but never more than `limit` radians: real wrists don't fold.
const NEG_Z = new THREE.Vector3(0, 0, -1);
export function bendWrist(hand, dir, limit = 1.15) {
  hand.quaternion.identity();
  hand.parent.updateWorldMatrix(true, false);
  hand.parent.getWorldQuaternion(_q2);
  _v.copy(dir).applyQuaternion(_q2.invert()).normalize();
  _q.setFromUnitVectors(NEG_Z, _v);
  const angle = 2 * Math.acos(Math.min(1, Math.abs(_q.w)));
  if (angle > limit) _q.slerp(new THREE.Quaternion(), 1 - limit / angle);
  hand.quaternion.copy(_q);
  hand.updateWorldMatrix(false, true);
}

// Give `j` the world orientation `q`.
export function setWorldQuat(j, q) {
  j.parent.updateWorldMatrix(true, false);
  j.parent.getWorldQuaternion(_q2);
  j.quaternion.copy(_q2.invert().multiply(q));
  j.updateWorldMatrix(false, true);
}
