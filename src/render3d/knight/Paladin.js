import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js';
import { weapon, shield, antlerCrown } from './Knight.js';
import { figureMaterials } from './Mat.js';

// The Paladin (Mixamo's "Paladin J Nordstrom" with its Sword and Shield pack),
// played from its own motion-captured clips rather than our IK poses. Each
// clip is scrubbed by hand to the game's clock: a cut's wind-up, its contact
// frame and its follow-through are stretched or squeezed so the blade lands
// exactly when the combat code says it does (see CUTS and ClipPlayer).

const URL_PALADIN = new URL('../../../assets/models/paladin/paladin.glb', import.meta.url).href;
// The Green Knight: rigged from "Santa" by lawtrigg (Sketchfab, CC BY 4.0), recoloured green,
// with Mixamo's Pro Melee Axe Pack retargeted onto him in Blender (reference/greenknight_lawtrigg_work.blend).
// He carries our great axe in the Paladin's grip.
const URL_GREEN = new URL('../../../assets/models/greenknight/greenknight.glb', import.meta.url).href;
// The Green Knight's fists (his fingers were curled into the mesh in Blender, as his rig
// has no finger bones): the hole through each fist, in the hand bone's own frame (metres)
// and the way a haft runs through it (toward the axe head, or the bough's leaves).
const FIST = {
  R: { pos: [0.0369, 0.095, -0.0154], dir: [-0.385, 0, -0.923] },
  L: { pos: [-0.0369, 0.095, -0.0154], dir: [0.385, 0, -0.923] },
};
const DOWN = new THREE.Vector3(0, -1, 0);
// Set an object in a fist, its -y (blade or stem) running through the hole.
function inFist(obj, f) {
  obj.position.fromArray(f.pos);
  obj.quaternion.setFromUnitVectors(DOWN, new THREE.Vector3().fromArray(f.dir).normalize());
}
const FPS = 30;
const HEIGHT = 1.85;   // metres to the top of the head, as our other knights

// The blows, in clip frames: a = leaves the guard, w = top of the wind-up,
// c = contact (fastest point of the blade), e = settled after the follow-through.
// dir = the blade's travel at contact in the knight's own frame (right, up).
// Measured from the tip's speed in each clip (tools/paladin-lab.html).
export const CUTS = {
  overhead: { a: 24, w: 33, c: 36, e: 45, dir: [0.2, -0.95] },   // Mixamo's leaping attack, grounded
  attack2: { a: 2, w: 16, c: 19, e: 27, dir: [0.93, -0.35] },    // backhand across to his right
  attack3: { a: 8, w: 21, c: 24, e: 34, dir: [0.7, -0.14] },     // driving thrust
  slash: { a: 4, w: 16, c: 19, e: 28, dir: [-0.43, -0.35] },     // forehand, down to his left
  kick: { a: 0, w: 5, c: 10, e: 22, dir: [0, 0] },
};

// Which clip carries a blow travelling this way on screen ([clip, played backwards]).
// Gawain is seen from behind (screen right is his right); a foe faces you (screen right is his left).
// And the clips for everything else a knight does.
export const PALADIN_SET = {
  cuts: CUTS,
  player: { E: ['attack2'], SE: ['attack2'], S: ['overhead'], SW: ['slash'], W: ['slash'], NW: ['attack2', true], N: ['overhead', true], NE: ['slash', true] },
  foe: { S: ['overhead'], E: ['slash'], SE: ['slash'], W: ['attack2'], SW: ['attack2'], NE: ['attack2', true], NW: ['slash', true], N: ['overhead', true], T: ['attack3'] },
  bash: 'kick', idle: 'idle', guard: 'block_idle', flinch: 'block', hits: ['impact', 'impact3'], parried: 'impact2',
  death: 'death', taunt: 'power_up', walk: 'walk',
};

// Where a blow is at phase p (0 leaves the guard, 1 top of the wind-up, 2 contact,
// 3 settled), in clip frames. Played backwards a downward cut becomes a rising
// one: it winds up low (the cut's own end pose) and rises through the contact frame.
export function cutFrame(name, rev, p, table = CUTS) {
  const c = table[name];
  const low = c.c + (c.e - c.c) * 0.6;   // not the very end: that's a crouch
  const keys = rev ? [low, low, c.c, c.a] : [c.a, c.w, c.c, c.e];
  const q = Math.max(0, Math.min(3, p));
  const i = Math.min(2, Math.floor(q));
  return keys[i] + (keys[i + 1] - keys[i]) * (q - i);
}

const draco = () => new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');

let greenPromise = null;
export function loadGreenKnight(onProgress) {
  if (!greenPromise) {
    greenPromise = new GLTFLoader().setDRACOLoader(draco()).loadAsync(URL_GREEN, onProgress)
      // A head taller than the other foes of his size.
      .then(({ scene, animations }) => ({ kind: 'paladin', axeman: true, scene, animations, set: AXE_SET, scale: 1.13 }));
  }
  return greenPromise;
}

let promise = null;
export function loadPaladin(onProgress) {
  if (!promise) {
    promise = new GLTFLoader().setDRACOLoader(draco()).loadAsync(URL_PALADIN, onProgress)
      .then(({ scene, animations }) => {
        // Mixamo's overhead is a leaping blow; ours keeps his feet on the floor.
        const byName = Object.fromEntries(animations.map((c) => [c.name, c]));
        animations.push(groundClip(byName.attack, byName.block_idle, 'overhead'));
        return { kind: 'paladin', scene, animations, set: PALADIN_SET };
      });
  }
  return promise;
}

// A clip's upper body on planted legs: the hips and legs are held in the stance
// clip's first pose, and the hips' own motion (the leap, the lean) passes to the spine.
const LEGS = /(UpLeg|Leg|Foot|ToeBase|Toe_End)\./;
function groundClip(src, stance, name) {
  const at = (clip, track) => {
    const t = clip.tracks.find((x) => x.name === track);
    return t ? t.createInterpolant() : null;
  };
  const still = (track) => {
    const i = at(stance, track);
    return i ? Array.from(i.evaluate(0)) : null;
  };
  const hipsQ = src.tracks.find((t) => /Hips\.quaternion$/.test(t.name));
  const hipsName = hipsQ.name.replace('.quaternion', '');
  const Hs = new THREE.Quaternion().fromArray(still(hipsQ.name)).invert();
  const Ha = hipsQ.createInterpolant();
  const qa = new THREE.Quaternion();
  const qs = new THREE.Quaternion();
  const tracks = [];
  for (const tr of src.tracks) {
    const isHips = tr.name.startsWith(`${hipsName}.`);
    if (isHips || LEGS.test(tr.name)) {
      const v = still(tr.name);
      if (!v) continue;
      const T = tr.constructor;
      tracks.push(new T(tr.name, [0, src.duration], [...v, ...v]));
    } else if (/Spine\.quaternion$/.test(tr.name)) {
      const vals = new Float32Array(tr.values.length);
      for (let i = 0; i < tr.times.length; i++) {
        qa.fromArray(Ha.evaluate(tr.times[i]));
        qs.fromArray(tr.values, i * 4);
        Hs.clone().multiply(qa).multiply(qs).toArray(vals, i * 4);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(tr.name, Array.from(tr.times), Array.from(vals)));
    } else tracks.push(tr);
  }
  return new THREE.AnimationClip(name, src.duration, tracks);
}

// Plays one clip at a time at a time we choose, cross-fading when the clip changes.
export class ClipPlayer {
  constructor(model, animations) {
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const clip of animations) {
      const a = this.mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.play();
      a.enabled = false;
      a.weight = 0;
      this.actions[clip.name] = a;
    }
    this.cur = null;
    this.prev = null;
    this.mix = 1;
    this.fade = 0.12;
  }

  has(name) { return !!this.actions[name]; }
  dur(name) { return this.actions[name] ? this.actions[name].getClip().duration : 1; }

  // Show `name` at time t (s). `key` lets the same clip start afresh (a new blow).
  show(name, t, fade = 0.12, key = name) {
    if (!this.actions[name]) return;
    if (!this.cur || this.cur.key !== key) {
      if (this.cur && this.cur.name !== name) {
        if (this.prev && this.prev.name !== name && this.prev.name !== this.cur.name) this.actions[this.prev.name].enabled = false;
        this.prev = this.cur;
        this.mix = 0;
        this.fade = Math.max(0.001, fade);
      } else if (this.prev && this.prev.name === name) {
        this.prev = null;
        this.mix = 1;
      }
      this.cur = { name, key, t };
    }
    this.cur.t = t;
  }

  // Frame of a clip: t in frames.
  frame(name, f, fade, key) { this.show(name, f / FPS, fade, key); }

  update(dt) {
    if (!this.cur) return;
    this.mix = Math.min(1, this.mix + dt / this.fade);
    const s = this.mix * this.mix * (3 - 2 * this.mix);
    const set = (slot, w) => {
      const a = this.actions[slot.name];
      const d = a.getClip().duration;
      a.enabled = true;
      a.time = Math.max(0, Math.min(d - 1e-4, slot.t));
      a.weight = w;
    };
    if (this.prev && s < 1) set(this.prev, 1 - s);
    else if (this.prev) { this.actions[this.prev.name].enabled = false; this.prev = null; }
    set(this.cur, this.prev ? s : 1);
    this.mixer.update(0);
  }
}

// The Green Knight's axe blows (Pro Melee Axe Pack), measured the same way.
// The pack's axe is shorter than ours, so the wind-ups swing wide; contact is where the
// head passes in front of him.
export const AXE_CUTS = {
  downward: { a: 12, w: 25, c: 27, e: 33, dir: [-0.59, -0.8] },   // overhead chop, down to his left
  horizontal: { a: 12, w: 24, c: 30, e: 36, dir: [-1, 0.1] },    // round sweep to his left
  '360_high': { a: 14, w: 29, c: 33, e: 40, dir: [1, -0.1] },    // spinning sweep to his right
  '360_low': { a: 12, w: 27, c: 31, e: 37, dir: [0.6, -0.5] },   // spinning low sweep
  backhand: { a: 10, w: 25, c: 31, e: 38, dir: [-0.3, 0.9] },    // rising backhand hook
  kick: { a: 0, w: 14, c: 19, e: 30, dir: [0, 0] },
};
export const AXE_SET = {
  cuts: AXE_CUTS,
  player: { E: ['360_high'], SE: ['360_low'], S: ['downward'], SW: ['downward'], W: ['horizontal'], NW: ['backhand'], N: ['backhand'], NE: ['downward', true] },
  foe: { S: ['downward'], SE: ['downward'], E: ['horizontal'], NE: ['backhand'], N: ['backhand'], W: ['360_high'], SW: ['360_low'], NW: ['downward', true], T: ['backhand'] },
  bash: 'kick', idle: 'idle', guard: 'block_idle', flinch: 'block_react', hits: ['react_left', 'react_right'], parried: 'react_gut',
  death: 'death', taunt: 'battlecry', walk: 'walk',
};

// A knight figure built on the Paladin, with the handles the hall view expects:
// J (joints with unit scale), weaponObj (blade along -y from the grip), mats.
export function buildPaladin(assets, look, weaponKind, offhandKind, size = 1) {
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(assets.scene);
  root.add(model);
  root.updateMatrixWorld(true);
  const bone = (n) => model.getObjectByName(`mixamorig${n}`) || model.getObjectByName(`mixamorig:${n}`) || model.getObjectByName(n);
  const crown = bone('HeadTop_End');
  const top = crown ? crown.getWorldPosition(new THREE.Vector3()).y : new THREE.Box3().setFromObject(model).max.y;
  const unit = (HEIGHT / top) * size * (assets.scale || 1);
  model.scale.multiplyScalar(unit);
  root.updateMatrixWorld(true);

  // Materials: one atlas for the knight; the sword and shield get their own copies to tint.
  const mats = [];
  const own = (o) => {
    const m = o.material.clone();
    m.envMapIntensity = 0.8;
    mats.push(m);
    o.material = m;
    return m;
  };
  const meshes = {};
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false;
    meshes[o.name] = o;
  });
  const c = (hex) => new THREE.Color(hex);
  if (assets.axeman) return buildAxeman(assets, look, weaponKind, offhandKind, size, root, model, bone, meshes, own);
  const bodyMat = own(meshes.Body);
  meshes.Helmet.material = bodyMat;
  const swordMesh = meshes.Sword;
  const swordMat = own(swordMesh);
  const shieldMat = own(meshes.Shield);
  // The Paladin's steel is dark, so a livery is laid on brighter than its own colour.
  if (look.tint) {
    bodyMat.color.copy(c(look.tint)).multiplyScalar(1.8);
    shieldMat.color.copy(c(look.trimTint || look.tint)).multiplyScalar(1.5);
  } else if (look.foe) {
    // Foes without a harness of their own: duller steel washed with their livery.
    bodyMat.color.lerp(c(look.tabard || '#888888'), 0.7).multiplyScalar(1.5);
    bodyMat.metalness = 0.6;
    shieldMat.color.lerp(c(look.shield || look.tabard || '#888888'), 0.7).multiplyScalar(1.4);
  } else bodyMat.color.multiplyScalar(1.2);
  if (look.shieldTint) shieldMat.color.multiply(c(look.shieldTint));
  if (look.swordId === 'clarent') { swordMat.color.multiply(c('#ffd98a')); swordMat.metalness = 1; swordMat.roughness = 0.22; }
  if (look.swordId === 'excalibur') { swordMat.emissive = c('#47607f'); swordMat.roughness = 0.15; swordMat.metalness = 1; }

  const J = handles(bone);
  root.updateMatrixWorld(true);

  // The blade: from the sword joint out to the farthest point of the sword.
  const sj = bone('Sword_joint');
  const pos = swordMesh.geometry.attributes.position;
  const base = sj.getWorldPosition(new THREE.Vector3());
  const p = new THREE.Vector3();
  let far = null;
  let farD = 0;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    swordMesh.localToWorld(p);
    const d = p.distanceTo(base);
    if (d > farD) { farD = d; far = p.clone(); }
  }
  const weaponObj = new THREE.Object3D();
  sj.add(weaponObj);
  weaponObj.scale.setScalar(1 / sj.getWorldScale(new THREE.Vector3()).x);
  root.updateMatrixWorld(true);
  const dirLocal = weaponObj.worldToLocal(far.clone()).normalize();
  weaponObj.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirLocal);
  root.updateMatrixWorld(true);
  weaponObj.attach(swordMesh);
  let weaponLen = farD;
  let weaponMats = [swordMat];
  const M = { ...figureMaterials(look), extra: [] };
  if (weaponKind && weaponKind !== 'sword') {
    // Axes and falchions: our own weapon in the Paladin's grip.
    swordMesh.visible = false;
    const w = weapon(weaponKind, M, { ...look, blade: look.blade || '#dfe4ea' });
    w.g.rotation.y = Math.PI / 2;
    weaponObj.add(w.g);
    weaponLen = w.len;
    weaponMats = [M.blade, M.metal];
    mats.push(M.metal, M.blade, M.matte);
  }

  // The off hand: the Paladin's shield, smaller for a buckler; none, or a holly bough.
  const shieldMesh = meshes.Shield;
  let offhand = shieldMesh;
  if (!offhandKind || offhandKind === 'holly') {
    shieldMesh.visible = false;
    if (offhandKind === 'holly') {
      offhand = holly(bone, look, M);
      mats.push(M.matte);
    }
  } else if (offhandKind === 'buckler' || offhandKind === 'round') {
    shieldMesh.scale.multiplyScalar(offhandKind === 'buckler' ? 0.62 : 0.85);
  }

  if (look.antler) mats.push(...antlers(bone, look, size));
  model.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  const player = new ClipPlayer(model, assets.animations);
  return {
    root, model, J, weaponObj, weaponLen, weaponMats, offhand, mats, M, size: 1, bodyScale: 1, clips: player, set: assets.set,
  };
}

// A unit-scale object riding a bone (the model is in centimetres under a scaled root).
function onBone(b) {
  const h = new THREE.Object3D();
  b.add(h);
  h.scale.setScalar(1 / b.getWorldScale(new THREE.Vector3()).x);
  return h;
}

// Joints for the view: unit-scale handles riding the bones (+y up the bone).
function handles(bone) {
  const J = {};
  [['pelvis', 'Hips'], ['spine', 'Spine'], ['chest', 'Spine2'], ['neck', 'Neck'], ['head', 'Head'],
    ['shR', 'RightArm'], ['elR', 'RightForeArm'], ['haR', 'RightHand'], ['shL', 'LeftArm'], ['elL', 'LeftForeArm'], ['haL', 'LeftHand'],
    ['hipR', 'RightUpLeg'], ['knR', 'RightLeg'], ['ftR', 'RightFoot'], ['hipL', 'LeftUpLeg'], ['knL', 'LeftLeg'], ['ftL', 'LeftFoot']]
    .forEach(([k, n]) => { J[k] = onBone(bone(n)); });
  return J;
}

// A holly bough held upright in the left fist.
function holly(bone, look, M) {
  const h = shield('holly', look, M);
  const hb = onBone(bone('LeftHand'));
  hb.position.set(0, 0.09 / bone('LeftHand').getWorldScale(new THREE.Vector3()).x, 0);
  hb.rotation.x = Math.PI / 2;
  h.scale.setScalar(1.7);
  hb.add(h);
  return h;
}

// The Green Knight's antlers on the head.
function antlers(bone, look, size) {
  const crown = antlerCrown(look);
  const head = bone('Head');
  const hb = onBone(head);
  hb.position.set(0, 0.02 / head.getWorldScale(new THREE.Vector3()).x, 0);
  crown.scale.setScalar(size * 0.9);
  hb.add(crown);
  return crown.userData.mats;
}

// The Green Knight: a big bearded man, green from head to foot (his own textures), with
// his great axe in his right hand and a holly bough in his left.
function buildAxeman(assets, look, weaponKind, offhandKind, size, root, model, bone, meshes, own) {
  const mats = Object.values(meshes).map(own);
  mats.forEach((m) => { m.envMapIntensity = m.metalness > 0.5 ? 1 : 0.35; });
  const J = handles(bone);
  root.updateMatrixWorld(true);
  const M = { ...figureMaterials(look), extra: [] };
  const weaponObj = onBone(bone('RightHand'));
  inFist(weaponObj, FIST.R);
  const w = weapon(weaponKind || 'greataxe', M, { ...look, blade: look.blade || '#dfe4ea' });
  w.g.rotation.y = Math.PI / 2;
  w.g.scale.setScalar(size * 0.75);   // nearer the pack's own axe, so its swings stay off the floor
  weaponObj.add(w.g);
  mats.push(M.metal, M.blade, M.matte);
  let offhand = new THREE.Object3D();
  if (offhandKind === 'holly') {
    offhand = shield('holly', look, M);
    offhand.scale.setScalar(1.7);
    const hb = onBone(bone('LeftHand'));
    inFist(hb, FIST.L);
    hb.add(offhand);
  }   // bare-headed: no antlers
  model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {
    root, model, J, weaponObj, weaponLen: w.len * size * 0.75, weaponMats: [M.blade, M.metal], offhand, mats, M, size: 1, bodyScale: 1,
    clips: new ClipPlayer(model, assets.animations), set: assets.set,
  };
}
