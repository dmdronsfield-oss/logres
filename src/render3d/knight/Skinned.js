import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js';
import { DIM, buildSkeleton, weapon, shield } from './Knight.js';
import { figureMaterials } from './Mat.js';

// Skinned characters made in a real 3D tool (here Quaternius's CC0 "Lowpoly
// Animated Knight") driven by our motion system. Our Animator poses an
// invisible skeleton built to the model's own proportions; each frame its
// joint orientations are copied onto the model's bones (retargeting), so all
// the directional attacks, blocks and dodges still line up with the gameplay.
// The same layer takes our own Sir Gawain, modelled and rigged in Blender
// (assets/models/gawain/), with the same bone names.

const BASE = new URL('../../../assets/models/quaternius-knight/', import.meta.url).href;
const GAWAIN = new URL('../../../assets/models/gawain/gawain.glb', import.meta.url).href;
const INKXO = new URL('../../../assets/models/inkxo-knight/inkxo-knight.glb', import.meta.url).href;

// INKXO's knight uses a Rigify metarig; its bones under our names.
const INKXO_NAMES = {
  Hips: 'spine', Abdomen: 'spine001', Torso: 'spine003', Neck: 'spine004', Head: 'head',
  UpperArmR: 'upper_armR', LowerArmR: 'forearmR', PalmR: 'handR', MiddleHandR: 'f_middle01R', FingersR: 'f_middle02R',
  UpperArmL: 'upper_armL', LowerArmL: 'forearmL', PalmL: 'handL', MiddleHandL: 'f_middle01L', FingersL: 'f_middle02L',
  UpperLegR: 'thighR', LowerLegR: 'shinR', FootR: 'footR', UpperLegL: 'thighL', LowerLegL: 'shinL', FootL: 'footL',
};

// Our joint -> the model's bone (FBXLoader strips the dots from Blender names).
const MAP = {
  pelvis: 'Hips', spine: 'Abdomen', chest: 'Torso', neck: 'Neck', head: 'Head',
  shR: 'UpperArmR', elR: 'LowerArmR', haR: 'PalmR', shL: 'UpperArmL', elL: 'LowerArmL', haL: 'PalmL',
  hipR: 'UpperLegR', knR: 'LowerLegR', ftR: 'FootR', hipL: 'UpperLegL', knL: 'LowerLegL', ftL: 'FootL',
};
// Child bone used to find each limb bone's direction at rest.
const NEXT = { UpperArmR: 'LowerArmR', LowerArmR: 'PalmR', PalmR: 'FingersR', UpperArmL: 'LowerArmL', LowerArmL: 'PalmL', PalmL: 'FingersL', UpperLegR: 'LowerLegR', LowerLegR: 'FootR', UpperLegL: 'LowerLegL', LowerLegL: 'FootL' };
const ORDER = ['pelvis', 'spine', 'chest', 'neck', 'head', 'shR', 'elR', 'haR', 'shL', 'elL', 'haL', 'hipR', 'knR', 'ftR', 'hipL', 'knL', 'ftL'];

let assetsPromise = null;

// FBX meshes come with faces interleaved by material, which three.js draws as
// hundreds of separate pieces. Regroup each geometry's triangles by material
// once, so a mesh costs one draw per material.
function regroup(root) {
  root.traverse((o) => {
    const g = o.geometry;
    if (!o.isMesh || !g || g.groups.length <= 1) return;
    const geo = g.index ? g.toNonIndexed() : g;
    const order = [...geo.groups].sort((a, b) => a.materialIndex - b.materialIndex);
    const out = {};
    for (const name of Object.keys(geo.attributes)) {
      const a = geo.attributes[name];
      out[name] = { src: a, arr: new a.array.constructor(a.array.length), k: 0 };
    }
    const groups = [];
    let vert = 0;
    for (const grp of order) {
      for (const name of Object.keys(out)) {
        const o2 = out[name];
        const n = o2.src.itemSize;
        o2.arr.set(o2.src.array.subarray(grp.start * n, (grp.start + grp.count) * n), o2.k);
        o2.k += grp.count * n;
      }
      const last = groups[groups.length - 1];
      if (last && last.materialIndex === grp.materialIndex) last.count += grp.count;
      else groups.push({ start: vert, count: grp.count, materialIndex: grp.materialIndex });
      vert += grp.count;
    }
    const ng = new THREE.BufferGeometry();
    for (const name of Object.keys(out)) {
      const a = out[name].src;
      ng.setAttribute(name, new THREE.BufferAttribute(out[name].arr, a.itemSize, a.normalized));
    }
    groups.forEach((x) => ng.addGroup(x.start, x.count, x.materialIndex));
    ng.computeBoundingBox();
    ng.computeBoundingSphere();
    o.geometry = ng;
  });
  return root;
}

export function loadQuaternius() {
  if (!assetsPromise) {
    const L = new FBXLoader();
    const get = (n) => L.loadAsync(`${BASE}${n}.fbx`);
    assetsPromise = Promise.all(['KnightCharacter', 'Sword', 'Helmet1', 'Helmet2', 'Helmet3', 'ShoulderPads'].map(get))
      .then((list) => list.map(regroup))
      .then(([knight, sword, h1, h2, h3, pads]) => ({ knight, sword, helmets: { h1, h2, h3 }, pads }));
  }
  return assetsPromise;
}

// Sir Gawain from Blender: one skinned body plus separate sword and shield
// objects (grip / centre at their origins). Metres, authored materials.
let gawainPromise = null;
export function loadGawain() {
  if (!gawainPromise) {
    gawainPromise = new GLTFLoader().loadAsync(GAWAIN).then(({ scene }) => {
      const take = (n) => {
        const o = scene.getObjectByName(n);
        o.removeFromParent();
        o.position.set(0, 0, 0);
        return o;
      };
      const sword = take('Weapon');
      const shieldObj = take('Shield');
      return { kind: 'gltf', knight: scene, sword, shield: shieldObj };
    });
  }
  return gawainPromise;
}

// Give a cloned object its own copies of its materials (so hit flashes and
// tints stay per knight) and return them.
function ownMaterials(obj) {
  const mats = [];
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map((m) => {
      const mm = m.clone();
      mm.envMapIntensity = mm.metalness > 0.5 ? 1 : 0.35;
      mats.push(mm);
      return mm;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });
  return mats;
}

// INKXO's "Medieval Knight Armor (Low-poly / Rigged)" (CC BY 4.0), whole and
// unaltered apart from smaller textures; Draco-compressed. It carries its own
// sheathed sword, so the sword and lion shield in hand come from Gawain's file.
let inkxoPromise = null;
export function loadInkxo() {
  if (!inkxoPromise) {
    const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    inkxoPromise = Promise.all([loader.loadAsync(INKXO), loadGawain()])
      .then(([{ scene }, g]) => ({ kind: 'gltf', knight: scene, sword: g.sword, shield: g.shield, names: INKXO_NAMES, curlFingers: true }));
  }
  return inkxoPromise;
}

const v = new THREE.Vector3();
const v2 = new THREE.Vector3();
const q = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const m4 = new THREE.Matrix4();
const X = new THREE.Vector3();
const Y = new THREE.Vector3();
const Z = new THREE.Vector3();

function std(color, metal = 0, rough = 0.6) {
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, flatShading: true, envMapIntensity: metal ? 1 : 0.3 });
}

// Recolour an accessory's materials by name.
function dress(obj, colours) {
  const mats = [];
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map((m) => {
      const n = (m.name || '').toLowerCase();
      const pick = colours[n] || colours.default;
      const mm = std(pick[0], pick[1], pick[2]);
      mats.push(mm);
      return mm;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
    o.castShadow = true;
  });
  return mats;
}

export function buildSkinnedKnight(assets, look, weaponKind, offhandKind, size = 1) {
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(assets.knight);
  model.animations = assets.knight.animations;
  const gltf = assets.kind === 'gltf';
  const height = 1.85 * size;
  const unit = gltf ? size : height / 539;   // Quaternius's model is ~539 units tall (centimetres)
  model.scale.setScalar(unit);
  root.add(model);
  root.updateMatrixWorld(true);

  // Livery: armour in the knight's colours, skin, boots.
  const plate = look.plate || '#b9bec6';
  const mats = gltf ? ownMaterials(model) : [];
  // Livery for a borrowed harness: steel recoloured, edges and plume in their own colours.
  if (gltf && look.tint) {
    const c = (hex) => new THREE.Color(hex);
    mats.forEach((m) => {
      const n = m.name || '';
      if (/Leather|Padding|Belt|Hanger/i.test(n) || !m.color) return;
      if (/Feather/i.test(n)) m.color.multiply(c(look.plumeTint || look.tint));
      else if (/Rims|EdgeRein|Scabbard|Ring/i.test(n)) m.color.multiply(c(look.trimTint || look.tint));
      else m.color.multiply(c(look.tint));
    });
  }
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false;
    if (gltf) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map((m) => {
      const n = (m.name || '').toLowerCase();
      const mm = n === 'armor' ? std(look.tabard || plate, 0.35, 0.5) : n === 'skin' ? std(look.skin || '#e0b090', 0, 0.7) : std('#2a1c14', 0, 0.8);
      mats.push(mm);
      return mm;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });

  const names = assets.names || {};
  const nm = (n) => names[n] || n;
  const bone = (n) => model.getObjectByName(nm(n));
  // Close open gauntlets into a fist around the grip.
  if (assets.curlFingers) {
    model.traverse((o) => {
      if (!o.isBone) return;
      if (/^f_(index|middle|ring|pinky)0[123]/.test(o.name)) o.rotateX(1.35);
      else if (/^thumb0[23]/.test(o.name)) o.rotateX(0.6);
    });
    model.updateMatrixWorld(true);
  }
  const wpos = (n) => bone(n).getWorldPosition(new THREE.Vector3());

  // Proportions of this body, for our invisible skeleton and pose remapping.
  const P = {};
  for (const n of ['Hips', 'Abdomen', 'Torso', 'Neck', 'Head', 'UpperArmR', 'LowerArmR', 'PalmR', 'MiddleHandR', 'UpperLegR', 'LowerLegR', 'FootR']) P[n] = wpos(n);
  const D = {
    pelvisY: P.Hips.y, spine: P.Abdomen.y - P.Hips.y, chest: P.Torso.y - P.Abdomen.y, neck: P.Neck.y - P.Torso.y, head: P.Head.y - P.Neck.y,
    shX: Math.abs(P.UpperArmR.x), shY: P.UpperArmR.y - P.Torso.y, upper: P.UpperArmR.distanceTo(P.LowerArmR), fore: P.LowerArmR.distanceTo(P.PalmR),
    grip: P.PalmR.distanceTo(P.MiddleHandR), hipX: Math.abs(P.UpperLegR.x), hipY: P.UpperLegR.y - P.Hips.y,
    thigh: P.UpperLegR.distanceTo(P.LowerLegR), shin: P.LowerLegR.distanceTo(P.FootR), ankle: Math.max(0.02, P.FootR.y),
  };
  const sk = buildSkeleton(D, 1);
  root.add(sk.root);
  sk.root.updateMatrixWorld(true);

  // Bind: for each mapped bone, the fixed rotation C with bone = joint * C.
  // Limb joints (ours) point down their -y with the elbow/knee toward +z of
  // their frame; we build that frame from the bone's rest direction.
  const binds = [];
  for (const key of ORDER) {
    const b = bone(MAP[key]);
    const j = sk.J[key];
    const qb = b.getWorldQuaternion(new THREE.Quaternion());
    let qj;
    if (NEXT[MAP[key]]) {
      const d = wpos(NEXT[MAP[key]]).sub(b.getWorldPosition(v)).normalize();
      const pole = key.startsWith('hip') || key.startsWith('kn') ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 0, -1);
      Y.copy(d).negate();
      Z.copy(pole).addScaledVector(Y, -pole.dot(Y)).normalize();
      X.crossVectors(Y, Z).normalize();
      Z.crossVectors(X, Y);
      qj = new THREE.Quaternion().setFromRotationMatrix(m4.makeBasis(X, Y, Z));
    } else {
      qj = j.getWorldQuaternion(new THREE.Quaternion());
    }
    binds.push({ key, b, j, C: qj.invert().multiply(qb) });
  }
  const hips = bone('Hips');
  const hipsDelta = hips.getWorldPosition(new THREE.Vector3()).sub(sk.J.pelvis.getWorldPosition(v));

  // Helmet and shoulder pads ride the head and torso bones.
  const helmetKey = gltf ? null : { greathelm: 'h1', antler: 'h3', bascinet: 'h2', nasal: 'h2', hood: null }[look.helm || 'greathelm'];
  if (helmetKey) {
    const h = assets.helmets[helmetKey].clone();
    mats.push(...dress(h, { default: [look.helmColor || plate, 0.8, 0.32] }));
    h.scale.setScalar(unit);
    h.position.set(0, 475 * unit, -2 * unit);
    root.add(h);
    root.updateMatrixWorld(true);
    bone('Head').attach(h);
  }
  if (assets.pads) {
    const pads = assets.pads.clone();
    mats.push(...dress(pads, { default: [plate, 0.8, 0.32] }));
    pads.scale.setScalar(unit);
    pads.position.set(0, 352 * unit, -12 * unit);
    root.add(pads);
    root.updateMatrixWorld(true);
    bone('Torso').attach(pads);
  }

  // Weapon and shield follow our skeleton's hands (so the glint sits on the blade).
  const weaponFrame = new THREE.Object3D();
  weaponFrame.rotation.x = Math.PI / 2;
  sk.J.gripR.add(weaponFrame);
  const holder = new THREE.Object3D();
  root.add(holder);
  let weaponObj;
  let weaponLen;
  const M = { ...figureMaterials(look), extra: [] };
  let swordMats = null;
  if (weaponKind === 'sword' && gltf) {
    const s = assets.sword.clone();
    swordMats = ownMaterials(s);
    mats.push(...swordMats);
    s.scale.setScalar(unit);   // blade already runs down -y from the grip
    weaponObj = new THREE.Object3D();
    weaponObj.add(s);
    weaponLen = -new THREE.Box3().setFromObject(s).min.y;   // grip to point
  } else if (weaponKind === 'sword') {
    const s = assets.sword.clone();
    mats.push(...dress(s, { metal: ['#dfe4ea', 0.9, 0.22], gold: ['#d4a13a', 1, 0.3], red: ['#8a1c1c', 0, 0.6], brown: ['#4a2f1a', 0, 0.8], default: ['#cccccc', 0.5, 0.4] }));
    s.scale.setScalar(unit * 0.62);
    s.rotation.x = Math.PI;   // its blade runs up +y; ours runs down -y
    weaponObj = new THREE.Object3D();
    weaponObj.add(s);
    weaponLen = 386 * unit * 0.62;
  } else {
    const w = weapon(weaponKind, M, { ...look, blade: look.blade || '#dfe4ea' });
    weaponObj = w.g;
    weaponLen = w.len;
    mats.push(M.metal, M.blade, M.matte);
  }
  holder.add(weaponObj);
  const shieldHolder = new THREE.Object3D();
  root.add(shieldHolder);
  let off;
  if (gltf && offhandKind === 'heater' && !look.tint) {
    off = assets.shield.clone();
    mats.push(...ownMaterials(off));
    off.scale.setScalar(unit);
  } else {
    off = shield(offhandKind, { plate, ...look }, M);
  }
  shieldHolder.add(off);
  mats.push(...M.extra, M.metal, M.matte);

  // Pose remap: our clips are authored for a 1.9 m knight; scale them to this body.
  const kL = (D.pelvisY + D.hipY) / (DIM.pelvisY + DIM.hipY);
  const shoulderUp = D.spine + D.chest + D.shY;
  const kA = (D.upper + D.fore + D.grip) / (DIM.upper + DIM.fore + DIM.grip);
  const ourUp = DIM.spine + DIM.chest + DIM.shY;
  const mapPose = (p) => {
    const o = {};
    for (const k of Object.keys(p)) o[k] = p[k].slice();
    o.pelvis = [p.pelvis[0] * kL, D.pelvisY + (p.pelvis[1] - DIM.pelvisY) * kL, p.pelvis[2] * kL];
    for (const f of ['footL', 'footR']) o[f] = [p[f][0] * kL, p[f][1] * kL, p[f][2]];
    for (const [h, side] of [['handR', -1], ['handL', 1]]) {
      const sx = side * DIM.shX;
      const sy = p.pelvis[1] + ourUp;
      const ox = side * D.shX;
      const oy = o.pelvis[1] + shoulderUp;
      o[h] = [ox + (p[h][0] - sx) * kA, oy + (p[h][1] - sy) * kA, o.pelvis[2] + (p[h][2] - p.pelvis[2]) * kA];
    }
    return o;
  };

  const retarget = () => {
    sk.root.updateMatrixWorld(true);
    for (const { key, b, j, C } of binds) {
      j.getWorldQuaternion(q).multiply(C);
      b.parent.getWorldQuaternion(q2);
      b.quaternion.copy(q2.invert().multiply(q));
      if (key === 'pelvis') {
        j.getWorldPosition(v).add(v2.copy(hipsDelta));
        b.parent.worldToLocal(v);
        b.position.copy(v);
      }
      b.updateMatrixWorld(true);
    }
    weaponFrame.updateMatrixWorld(true);
    weaponFrame.matrixWorld.decompose(holder.position, holder.quaternion, v);
    root.worldToLocal(holder.position);
    holder.quaternion.premultiply(root.getWorldQuaternion(q2).invert());
    sk.J.gripL.updateMatrixWorld(true);
    sk.J.gripL.matrixWorld.decompose(shieldHolder.position, shieldHolder.quaternion, v);
    root.worldToLocal(shieldHolder.position);
    shieldHolder.quaternion.premultiply(root.getWorldQuaternion(q2).invert());
  };

  return {
    root, fig: sk.fig, J: sk.J, M, dims: D, mapPose, retarget, weaponObj, weaponLen, offhand: off,
    mats, weaponMats: swordMats || [M.blade, ...mats.filter((m) => m.metalness > 0.85)], size: 1, model, bodyScale: kA,
  };
}
