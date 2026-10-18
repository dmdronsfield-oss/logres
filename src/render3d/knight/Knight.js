import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';
import { figureMaterials, shieldTex } from './Mat.js';

// A knight is a skeleton of joints carrying rigid, sculpted armour plates
// (armour is rigid, so rigid parts per joint look right). Limbs hang along -y
// and the figure faces +z. Parts on the same joint and material are merged.

export const DIM = {
  pelvisY: 1.0, spine: 0.12, chest: 0.2, neck: 0.24, head: 0.09,
  shX: 0.2, shY: 0.17, upper: 0.3, fore: 0.27, grip: 0.09,
  hipX: 0.11, hipY: -0.06, thigh: 0.46, shin: 0.4, ankle: 0.08,
};

const V = (x, y) => new THREE.Vector2(x, y);
const lathe = (pts, segs = 22, phiStart = 0, phiLen = Math.PI * 2) => new THREE.LatheGeometry(pts.map(([r, y]) => V(r, y)), segs, phiStart, phiLen);

function extrude(points, depth, bevel = 0.006) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else s.lineTo(p[0], p[1]);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}

class PartBag {
  constructor() { this.byJoint = new Map(); }

  add(joint, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
    let g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(m);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    // keep only the attributes every part shares, so they merge cleanly
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    g.clearGroups();
    if (!this.byJoint.has(joint)) this.byJoint.set(joint, new Map());
    const bucket = this.byJoint.get(joint);
    if (!bucket.has(mat)) bucket.set(mat, []);
    bucket.get(mat).push(g);
  }

  build(meshes) {
    for (const [joint, bucket] of this.byJoint) {
      for (const [mat, geos] of bucket) {
        const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        joint.add(mesh);
        meshes.push(mesh);
      }
    }
  }
}

function joint(name, parent, x, y, z) {
  const j = new THREE.Object3D();
  j.name = name;
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

// ---------- head ----------

function face(bag, head, M, look) {
  bag.add(head, new THREE.SphereGeometry(0.1, 20, 16), M.skin, [0, 0.1, 0.0], [0, 0, 0], [0.95, 1.15, 1.05]);
  bag.add(head, new THREE.BoxGeometry(0.026, 0.045, 0.035), M.skin, [0, 0.1, 0.105]);
  [-1, 1].forEach((s) => {
    bag.add(head, new THREE.SphereGeometry(0.012, 8, 6), M.black, [s * 0.036, 0.128, 0.093]);
    bag.add(head, new THREE.BoxGeometry(0.04, 0.012, 0.015), M.hair, [s * 0.038, 0.148, 0.095], [0, 0, s * -0.2]);
  });
  if (look.beard) {
    bag.add(head, new THREE.SphereGeometry(0.105, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), M.hair, [0, 0.085, 0.012], [0, 0, 0], [1, 1.35, 1.05]);
    bag.add(head, new THREE.BoxGeometry(0.07, 0.016, 0.02), M.hair, [0, 0.07, 0.1]);
  }
}

function helm(bag, head, M, look) {
  switch (look.helm) {
    case 'bascinet': {
      // Pointed bascinet with a snouted visor, mail aventail, gold band and a plume.
      bag.add(head, lathe([[0, 0.33], [0.04, 0.31], [0.1, 0.24], [0.128, 0.15], [0.132, 0.06], [0.128, 0.0], [0, 0.0]]), M.dark, [0, 0.0, 0], [0, 0, 0], [1, 1, 1.08]);
      bag.add(head, new THREE.SphereGeometry(0.12, 16, 12, Math.PI * 0.1, Math.PI * 0.8, Math.PI * 0.25, Math.PI * 0.5), M.dark, [0, 0.11, 0.02], [0, 0, 0], [1.05, 0.95, 1.45]);
      [-1, 1].forEach((s) => bag.add(head, new THREE.BoxGeometry(0.05, 0.012, 0.03), M.black, [s * 0.04, 0.135, 0.172], [0, s * 0.35, 0]));
      for (let i = 0; i < 3; i++) bag.add(head, new THREE.BoxGeometry(0.012, 0.012, 0.03), M.black, [0.03, 0.07 - i * 0.02, 0.17]);
      bag.add(head, new THREE.CylinderGeometry(0.134, 0.134, 0.025, 24, 1, true), M.gold, [0, 0.03, 0], [0, 0, 0], [1, 1, 1.08]);
      bag.add(head, new THREE.CylinderGeometry(0.13, 0.2, 0.17, 20, 1, true), M.mail, [0, -0.06, -0.01], [0, 0, 0], [1, 1, 1.05]);
      bag.add(head, new THREE.CapsuleGeometry(0.035, 0.22, 4, 8), M.crest, [0, 0.36, -0.08], [-0.9, 0, 0]);
      break;
    }
    case 'nasal':
      face(bag, head, M, look);
      bag.add(head, lathe([[0, 0.3], [0.04, 0.28], [0.1, 0.2], [0.122, 0.14], [0.124, 0.1], [0, 0.1]]), M.dark, [0, 0, 0], [0, 0, 0], [1, 1, 1.08]);
      bag.add(head, new THREE.CylinderGeometry(0.126, 0.126, 0.03, 22, 1, true), M.gold, [0, 0.11, 0], [0, 0, 0], [1, 1, 1.08]);
      bag.add(head, new THREE.BoxGeometry(0.026, 0.11, 0.02), M.dark, [0, 0.07, 0.135]);
      bag.add(head, new THREE.CylinderGeometry(0.11, 0.14, 0.12, 18, 1, true), M.mail, [0, 0.02, -0.02]);
      break;
    case 'hood':
      face(bag, head, M, look);
      bag.add(head, new THREE.SphereGeometry(0.15, 20, 14, Math.PI / 2 + 0.7, Math.PI * 2 - 1.4, 0, Math.PI * 0.72), M.cloth, [0, 0.1, -0.01], [0, 0, 0], [1, 1.12, 1.05]);
      bag.add(head, new THREE.CylinderGeometry(0.15, 0.21, 0.12, 20), M.cloth, [0, -0.03, -0.01]);
      bag.add(head, new THREE.ConeGeometry(0.05, 0.22, 8), M.cloth, [0, 0.16, -0.16], [-1.9, 0, 0]);
      break;
    case 'antler': {
      bag.add(head, lathe([[0, 0.34], [0.1, 0.33], [0.14, 0.27], [0.145, 0.12], [0.145, -0.02], [0.132, -0.06], [0, -0.06]]), M.dark, [0, 0, 0], [0, 0, 0], [1, 1, 1.06]);
      bag.add(head, new THREE.BoxGeometry(0.22, 0.02, 0.03), M.black, [0, 0.15, 0.146]);
      bag.add(head, new THREE.BoxGeometry(0.02, 0.13, 0.03), M.black, [0, 0.07, 0.148]);
      bag.add(head, new THREE.TorusGeometry(0.146, 0.012, 6, 28), M.dark, [0, 0.24, 0], [Math.PI / 2, 0, 0], [1, 1.06, 1]);
      antlers(bag, head, M);
      break;
    }
    case 'greathelm':
    default:
      bag.add(head, lathe([[0, 0.29], [0.11, 0.285], [0.13, 0.26], [0.136, 0.17], [0.136, 0.0], [0.142, -0.04], [0, -0.04]]), M.dark, [0, 0, 0], [0, 0, 0], [1, 1, 1.06]);
      bag.add(head, new THREE.BoxGeometry(0.23, 0.022, 0.03), M.black, [0, 0.165, 0.137]);
      bag.add(head, new THREE.BoxGeometry(0.26, 0.022, 0.03), M.dark, [0, 0.19, 0.137]);
      bag.add(head, new THREE.BoxGeometry(0.03, 0.22, 0.025), M.gold, [0, 0.07, 0.146]);
      for (let i = 0; i < 4; i++) bag.add(head, new THREE.BoxGeometry(0.012, 0.012, 0.03), M.black, [-0.06 - (i % 2) * 0.025, 0.08 - Math.floor(i / 2) * 0.03, 0.135]);
      if (look.crest) bag.add(head, new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI), M.crest, [0, 0.3, -0.02], [0, Math.PI / 2, 0], [0.22, 1, 1.1]);
      break;
  }
}

function antlers(bag, head, M) {
  const beam = [[0.11, 0.24, 0], [0.2, 0.33, -0.02], [0.3, 0.47, -0.05], [0.36, 0.63, -0.02], [0.4, 0.8, 0.02], [0.47, 0.9, 0.0]];
  const tines = [
    [[0.2, 0.33, -0.02], [0.23, 0.44, 0.08], [0.21, 0.55, 0.12]],
    [[0.3, 0.47, -0.05], [0.39, 0.55, 0.05], [0.5, 0.6, 0.08]],
    [[0.36, 0.63, -0.02], [0.33, 0.75, 0.04], [0.31, 0.86, 0.01]],
    [[0.4, 0.8, 0.02], [0.37, 0.92, 0.04]],
  ];
  [-1, 1].forEach((s) => {
    const curve = (pts, r) => {
      const c = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x * s * 0.85, 0.24 + (y - 0.24) * 0.72, z)));
      bag.add(head, new THREE.TubeGeometry(c, 14, r, 6, false), M.bone);
    };
    curve(beam, 0.024);
    tines.forEach((t) => curve(t, 0.016));
  });
}

// ---------- weapons and shields ----------

function weapon(kind, M) {
  const g = new THREE.Object3D();
  const bag = new PartBag();
  let len;
  if (kind === 'axe' || kind === 'greataxe') {
    const big = kind === 'greataxe';
    len = big ? 1.3 : 0.72;
    bag.add(g, new THREE.CylinderGeometry(big ? 0.024 : 0.019, big ? 0.028 : 0.022, len + 0.15, 10), M.wood, [0, -len / 2 + 0.1, 0]);
    bag.add(g, new THREE.CylinderGeometry(big ? 0.032 : 0.026, big ? 0.032 : 0.026, 0.05, 10), M.steel, [0, 0.16, 0]);
    const hy = -len + 0.12;
    const sc = big ? 1.75 : 1;
    const head = extrude([
      [0, 0.06], [0.06, 0.05], [0.16, 0.11, 0.2, 0.12], [0.22, -0.14], [0.14, -0.1, 0.06, -0.06], [0, -0.05],
    ], 0.012, 0.008);
    bag.add(g, head, M.blade, [0.01, hy, 0], [0, 0, 0], [sc, sc, 1]);
    if (big) bag.add(g, extrude([[0, 0.04], [-0.12, 0.08], [-0.16, 0], [-0.12, -0.08], [0, -0.04]], 0.012, 0.008), M.blade, [0, hy, 0]);
    bag.add(g, new THREE.BoxGeometry(0.05, 0.16 * sc, 0.045), M.steel, [0, hy, 0]);
    bag.build([]);
    return { g, len: len + 0.02, M };
  }
  const fal = kind === 'falchion';
  const blade = fal ? 0.66 : 0.84;
  bag.add(g, new THREE.CylinderGeometry(0.017, 0.019, 0.14, 10), M.leather, [0, 0.0, 0]);
  bag.add(g, lathe([[0, 0.03], [0.026, 0.026], [0.034, 0], [0.026, -0.026], [0, -0.03]], 16), M.gold, [0, 0.09, 0], [Math.PI / 2, 0, 0]);
  bag.add(g, new THREE.BoxGeometry(0.27, 0.024, 0.036), M.gold, [0, -0.08, 0]);
  [-1, 1].forEach((s) => bag.add(g, new THREE.SphereGeometry(0.022, 10, 8), M.gold, [s * 0.135, -0.075, 0]));
  const pts = fal
    ? [[-0.025, 0], [0.025, 0], [0.05, -blade * 0.78], [0.05, -blade, -0.03, -blade], [-0.025, -blade * 0.5]]
    : [[-0.027, 0], [0.027, 0], [0.024, -blade * 0.85], [0, -blade], [-0.024, -blade * 0.85]];
  bag.add(g, extrude(pts, 0.004, 0.006), M.blade, [0, -0.09, 0]);
  if (!fal) [-1, 1].forEach((s) => bag.add(g, new THREE.BoxGeometry(0.011, blade * 0.62, 0.004), M.dark, [0, -0.09 - blade * 0.35, s * 0.006]));
  bag.build([]);
  return { g, len: 0.09 + blade };
}

function shield(kind, look, M) {
  const g = new THREE.Object3D();
  const bag = new PartBag();
  if (!kind) return g;
  if (kind === 'holly') {
    bag.add(g, new THREE.CylinderGeometry(0.012, 0.016, 0.55, 6), M.wood, [0, -0.18, 0]);
    for (let i = 0; i < 9; i++) {
      bag.add(g, extrude([[0, 0], [0.03, 0.02], [0.07, 0], [0.03, -0.02]], 0.004, 0), M.leaf, [(i % 2 ? 1 : -1) * 0.01, -0.03 - i * 0.05, 0.01], [0, 0, (i % 2 ? 0.4 : Math.PI - 0.4)]);
    }
    bag.build([]);
    return g;
  }
  const field = look.shield || look.tabard;
  const charge = look.shieldCharge ?? look.charge;
  const round = kind !== 'heater';
  const faceTex = shieldTex(field, charge, look.chargeColor, round).clone();
  faceTex.needsUpdate = true;
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.65, metalness: 0.05, envMapIntensity: 0.4 });
  M.extra.push(faceMat);
  if (round) {
    const r = kind === 'buckler' ? 0.16 : 0.28;
    const disk = new THREE.CylinderGeometry(r, r, 0.035, 32);
    disk.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(disk, [M.wood, faceMat, M.wood]);
    mesh.castShadow = true;
    g.add(mesh);
    bag.add(g, new THREE.TorusGeometry(r, 0.018, 8, 36), M.gold);
    bag.add(g, new THREE.SphereGeometry(r * 0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.steel, [0, 0, 0.018], [Math.PI / 2, 0, 0]);
  } else {
    const outline = [[-0.22, 0.27], [0.22, 0.27], [0.22, 0.0], [0.2, -0.25, 0, -0.37], [-0.2, -0.25, -0.22, 0.0]];
    const face = extrude(outline, 0.03, 0.006);
    // map the shape's bounding box onto the texture
    const minX = -0.228;
    const minY = -0.376;
    const w = 0.456;
    const h = 0.652;
    faceTex.repeat.set(1 / w, 1 / h);
    faceTex.offset.set(-minX / w, -minY / h);
    const mesh = new THREE.Mesh(face, [faceMat, M.wood]);
    mesh.castShadow = true;
    g.add(mesh);
    bag.add(g, extrude(outline, 0.02, 0.006), M.gold, [0, -0.004, -0.012], [0, 0, 0], [1.06, 1.05, 1]);
  }
  bag.build([]);
  return g;
}

// ---------- the knight ----------

export function buildKnight(look, weaponKind, offhandKind, size = 1) {
  const M = { ...figureMaterials(look), extra: [] };
  const root = new THREE.Group();
  const fig = joint('fig', root, 0, 0, 0);
  fig.scale.setScalar(size);
  const J = {};
  J.pelvis = joint('pelvis', fig, 0, DIM.pelvisY, 0);
  J.spine = joint('spine', J.pelvis, 0, DIM.spine, 0);
  J.chest = joint('chest', J.spine, 0, DIM.chest, 0);
  J.neck = joint('neck', J.chest, 0, DIM.neck - 0.04, 0);
  J.head = joint('head', J.neck, 0, DIM.head, 0);
  for (const [side, s] of [['R', -1], ['L', 1]]) {
    J[`sh${side}`] = joint(`sh${side}`, J.chest, s * DIM.shX, DIM.shY, 0);
    J[`el${side}`] = joint(`el${side}`, J[`sh${side}`], 0, -DIM.upper, 0);
    J[`ha${side}`] = joint(`ha${side}`, J[`el${side}`], 0, -DIM.fore, 0);
    J[`grip${side}`] = joint(`grip${side}`, J[`ha${side}`], 0, -DIM.grip, 0);
    J[`hip${side}`] = joint(`hip${side}`, J.pelvis, s * DIM.hipX, DIM.hipY, 0);
    J[`kn${side}`] = joint(`kn${side}`, J[`hip${side}`], 0, -DIM.thigh, 0);
    J[`ft${side}`] = joint(`ft${side}`, J[`kn${side}`], 0, -DIM.shin, 0);
  }
  const bag = new PartBag();

  // Hips: fauld lames over a mail skirt, belt.
  for (let i = 0; i < 3; i++) bag.add(J.pelvis, new THREE.CylinderGeometry(0.192 + i * 0.012, 0.204 + i * 0.012, 0.06, 26, 1, true), M.steel, [0, 0.05 - i * 0.052, 0], [0, 0, 0], [1, 1, 0.78]);
  bag.add(J.pelvis, new THREE.CylinderGeometry(0.21, 0.255, 0.22, 22, 1, true), M.mail, [0, -0.15, 0], [0, 0, 0], [1, 1, 0.8]);
  bag.add(J.pelvis, new THREE.CylinderGeometry(0.205, 0.205, 0.05, 24), M.leather, [0, 0.1, 0], [0, 0, 0], [1, 1, 0.8]);
  bag.add(J.pelvis, new THREE.BoxGeometry(0.06, 0.055, 0.02), M.gold, [0, 0.1, 0.168]);
  bag.add(J.spine, new THREE.CylinderGeometry(0.18, 0.19, 0.16, 22), M.mail, [0, 0.02, 0], [0, 0, 0], [1, 1, 0.78]);

  // Chest: rounded cuirass with a ridge, surcoat over the lower chest, gorget.
  bag.add(J.chest, new THREE.SphereGeometry(0.215, 26, 18, 0, Math.PI * 2, Math.PI * 0.18, Math.PI * 0.62), M.steel, [0, 0.02, 0], [0, 0, 0], [1.02, 1.12, 0.74]);
  bag.add(J.chest, new THREE.BoxGeometry(0.014, 0.2, 0.02), M.steel, [0, 0.07, 0.152]);
  bag.add(J.chest, new THREE.CylinderGeometry(0.228, 0.2, 0.3, 28, 1, true, Math.PI, Math.PI * 2), M.surcoat, [0, -0.05, 0], [0, 0, 0], [1, 1, 0.76]);
  bag.add(J.chest, new THREE.CylinderGeometry(0.11, 0.155, 0.07, 22), M.steel, [0, 0.19, 0]);
  bag.add(J.chest, new THREE.CylinderGeometry(0.093, 0.112, 0.05, 20), M.steel, [0, 0.235, 0]);
  // Pauldrons: three overlapping lames each side, gold-edged.
  [-1, 1].forEach((s) => {
    [[0.125, 0.21, 0.17, 0.35], [0.115, 0.25, 0.11, 0.62], [0.1, 0.275, 0.05, 0.9]].forEach(([r, x, y, rot], i) => {
      bag.add(J.chest, new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), M.steel, [s * x, y, 0], [0, 0, -s * rot], [1.12, 0.8, 1.12]);
      bag.add(J.chest, new THREE.TorusGeometry(r * 1.12, 0.007, 4, 24), M.gold, [s * x, y, 0], [Math.PI / 2, 0, -s * rot], [1, 1, 0.71]);
    });
  });
  bag.add(J.neck, new THREE.CylinderGeometry(0.055, 0.062, 0.12, 14), M.mail, [0, 0.03, 0]);

  helm(bag, J.head, M, look);

  // Arms: mail at the shoulder, rerebrace, couter with a fan, vambrace, gauntlet.
  for (const [side, s] of [['R', -1], ['L', 1]]) {
    const sh = J[`sh${side}`];
    const el = J[`el${side}`];
    const ha = J[`ha${side}`];
    bag.add(sh, new THREE.CylinderGeometry(0.066, 0.06, 0.09, 14), M.mail, [0, -0.03, 0]);
    bag.add(sh, new THREE.CylinderGeometry(0.058, 0.052, 0.22, 14), M.steel, [0, -0.17, 0]);
    bag.add(el, new THREE.SphereGeometry(0.058, 14, 10), M.steel);
    bag.add(el, new THREE.CylinderGeometry(0.075, 0.075, 0.012, 16, 1, false, 0, Math.PI), M.steel, [s * 0.05, 0, -0.01], [0, 0, Math.PI / 2]);
    bag.add(el, new THREE.CylinderGeometry(0.05, 0.043, 0.22, 14), M.steel, [0, -0.13, 0]);
    bag.add(ha, new THREE.CylinderGeometry(0.064, 0.046, 0.075, 14), M.steel, [0, 0.0, 0]);
    bag.add(ha, new THREE.BoxGeometry(0.075, 0.085, 0.06), M.steel, [0, -0.07, 0.005]);
    bag.add(ha, new THREE.BoxGeometry(0.07, 0.04, 0.07), M.leather, [0, -0.115, 0.012]);
  }

  // Legs: cuisses, poleyns with side wings, greaves, laminated sabatons.
  for (const [side, s] of [['R', -1], ['L', 1]]) {
    const hip = J[`hip${side}`];
    const kn = J[`kn${side}`];
    const ft = J[`ft${side}`];
    bag.add(hip, new THREE.CylinderGeometry(0.092, 0.088, 0.09, 14), M.mail, [0, -0.03, 0]);
    bag.add(hip, new THREE.CylinderGeometry(0.086, 0.068, 0.36, 14), M.steel, [0, -0.23, 0.006]);
    bag.add(kn, new THREE.SphereGeometry(0.064, 14, 10), M.steel, [0, 0, 0.028]);
    bag.add(kn, new THREE.CylinderGeometry(0.07, 0.07, 0.012, 16, 1, false, 0, Math.PI), M.steel, [s * 0.055, 0, 0.0], [0, 0, Math.PI / 2]);
    bag.add(kn, new THREE.CylinderGeometry(0.062, 0.048, 0.34, 14), M.steel, [0, -0.2, 0]);
    bag.add(ft, new THREE.BoxGeometry(0.1, 0.075, 0.13), M.steel, [0, -0.04, 0.03]);
    bag.add(ft, new THREE.BoxGeometry(0.09, 0.055, 0.09), M.steel, [0, -0.052, 0.12], [0.22, 0, 0]);
    bag.add(ft, new THREE.BoxGeometry(0.075, 0.042, 0.07), M.steel, [0, -0.062, 0.19], [0.32, 0, 0]);
    bag.add(ft, new THREE.BoxGeometry(0.085, 0.06, 0.07), M.leather, [0, -0.045, -0.05]);
  }

  // Green Knight: leaf mantle over the shoulders and chest.
  if (look.leafy) {
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const rr = 0.22 + (i % 3) * 0.03;
      bag.add(J.chest, extrude([[0, 0], [0.05, 0.03], [0.11, 0], [0.05, -0.03]], 0.01, 0), M.leaf, [Math.cos(a) * rr, 0.16 + (i % 2) * 0.04, Math.sin(a) * rr * 0.8], [0.5, -a, 0.3]);
    }
  }

  const meshes = [];
  bag.build(meshes);

  const w = weapon(weaponKind, M);
  J.gripR.add(w.g);
  const off = shield(offhandKind, look, M);
  J.gripL.add(off);

  const mats = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.emissive && !mats.includes(m)) mats.push(m); });
  });
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

// Turn `j` so its local `axis` points along world direction `dir`.
export function aimJoint(j, axis, dir) {
  j.parent.updateWorldMatrix(true, false);
  j.parent.getWorldQuaternion(_q2);
  _v.copy(dir).applyQuaternion(_q2.invert()).normalize();
  j.quaternion.setFromUnitVectors(axis, _v);
  j.updateWorldMatrix(false, true);
}

// Give `j` the world orientation `q`.
export function setWorldQuat(j, q) {
  j.parent.updateWorldMatrix(true, false);
  j.parent.getWorldQuaternion(_q2);
  j.quaternion.copy(_q2.invert().multiply(q));
  j.updateWorldMatrix(false, true);
}
