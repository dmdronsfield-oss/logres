import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';
import { buildKnight } from '../render3d/knight/Knight.js';
import { Animator, GUARD, STATES, pose, windupPose, strikePose, recoverPose, playerSwingPose, mirrorDir, styleFor, bashPose, tauntPose } from '../render3d/knight/Motion.js';
import { Cloth } from '../render3d/knight/Cloth.js';
import { drapeTex } from '../render3d/knight/Mat.js';
import { PLAYER_LOOK, lookFor } from '../render3d/knight/Looks.js';
import { ENEMIES } from '../combat/enemies.js';
import { loadQuaternius, loadGawain, loadInkxo, buildSkinnedKnight } from '../render3d/knight/Skinned.js';
import * as SkeletonUtils from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js';

const [ASSETS, GAWAIN, INKXO] = await Promise.all([loadQuaternius(), loadGawain(), loadInkxo()]);

// Animation lab: one knight at a time playing each move on a loop, at real or
// slowed speed, from the game camera or orbiting. Uses exactly the same
// figures, poses and clips as the game, so what you judge here is what you get.

const ENEMY_Z = -3.4;
const PLAYER_Z = -1.4;

const FIGURES = [
  { id: 'gawain-inkxo', name: 'Sir Gawain (INKXO armour)', player: true, skinned: INKXO, look: { ...PLAYER_LOOK, blade: '#dfe3ea', shield: '#2b4a9b', shieldCharge: 'lion' }, weapon: 'sword', off: 'heater', size: 1, guard: GUARD.hero },
  { id: 'gawain-blend', name: 'Sir Gawain (Blender model)', player: true, skinned: GAWAIN, look: { ...PLAYER_LOOK, blade: '#dfe3ea', shield: '#2b4a9b', shieldCharge: 'lion' }, weapon: 'sword', off: 'heater', size: 1, guard: GUARD.hero },
  { id: 'gawain', name: 'Sir Gawain (code-built)', player: true, look: { ...PLAYER_LOOK, blade: '#dfe3ea', shield: '#2b4a9b', shieldCharge: 'lion' }, weapon: 'sword', off: 'heater', size: 1, guard: GUARD.hero },
  ...ENEMIES.map((d) => ({
    id: d.id, name: d.name, look: lookFor(d), weapon: d.weapon, off: d.offhand, size: d.size || 1, guard: d.weapon === 'greataxe' ? GUARD.giant : GUARD.ss,
    // As in the game: plate knights wear INKXO's harness; each weapon has its swing style.
    skinned: d.look && d.look.model === 'inkxo' ? INKXO : undefined, style: styleFor(d.weapon), taunt: d.taunt,
  })),
  // The CC0 rigged model (Quaternius), driven by our motion or playing its own clips.
  { id: 'q-ours', name: 'CC0 model: our motion', skinned: true, look: lookFor(ENEMIES[1]), weapon: 'sword', off: 'heater', size: 1, guard: GUARD.ss },
  { id: 'q-native', name: 'CC0 model: its own clips', native: true, size: 1, guard: GUARD.ss, look: {} },
];

const ENEMY_MOVES = [
  ['guard', 'Guard'], ['S', 'Overhead'], ['E', 'Forehand'], ['W', 'Backhand'], ['SE', 'Diag ↘'], ['SW', 'Diag ↙'], ['T', 'Thrust'],
  ['parried', 'Parried'], ['staggered', 'Stagger'], ['roar', 'Roar'], ['defeat', 'Defeat'], ['walk', 'Walk in'],
  ['bash', 'Shield bash'], ['taunt', 'Challenge'], ['highGuard', 'High guard'], ['lowGuard', 'Low guard'], ['shieldBlock', 'Takes a cut'], ['lock', 'Blade lock'],
];
const PLAYER_MOVES = [
  ['guard', 'Guard'], ['sw:E', 'Swipe →'], ['sw:W', 'Swipe ←'], ['sw:S', 'Swipe ↓'], ['sw:N', 'Swipe ↑'], ['sw:SE', 'Swipe ↘'], ['sw:SW', 'Swipe ↙'],
  ['sw:NE', 'Swipe ↗'], ['sw:NW', 'Swipe ↖'], ['block', 'Block'], ['dodgeL', 'Dodge ←'], ['dodgeR', 'Dodge →'], ['stun', 'Hit'], ['dead', 'Death'],
  ['pendragon', 'Pendragon'], ['lock', 'Blade lock'],
];

// Each move: total loop length (ms) and a sampler giving the target pose at time t.
function moveTimeline(fig, move) {
  if (fig.native) {
    const clip = ASSETS.knight.animations.find((a) => a.name === move) || ASSETS.knight.animations[0];
    return { len: clip.duration * 1000, native: clip, sample: () => ({ pose: fig.guard, omega: 8, phase: clip.name.replace('HumanArmature|', '') }) };
  }
  const g = fig.guard;
  const rest = { pose: g, omega: 8, phase: 'guard' };
  const at = (t) => ({ ...rest, t });
  if (move === 'guard') return { len: 3000, sample: () => rest };
  if (['S', 'E', 'W', 'SE', 'SW', 'T'].includes(move)) {
    // As in the game: wind-up, the release 90 ms before impact (1300 ms), strike, recover.
    const st = fig.style;
    return {
      len: 3000,
      sample: (t) => {
        if (t < 400) return at(t);
        if (t < 1210) return { pose: windupPose(g, move, (t - 400) / 810, st), omega: 24, phase: 'wind-up (telegraph 900 ms)' };
        if (t < 1300) return { pose: strikePose(g, move, ((t - 1210) / 90) * 110, st), omega: 48, phase: 'release' };
        if (t < 1820) return { pose: strikePose(g, move, 110 + t - 1300, st), omega: 40, phase: 'strike' };
        return { pose: recoverPose(g, move, t - 1820, st), omega: 18, phase: 'recover (open)' };
      },
    };
  }
  if (move === 'bash') {
    return {
      len: 2600,
      sample: (t) => {
        if (t < 300) return at(t);
        if (t < 1260) return { pose: bashPose(g, 'wind', (t - 300) / 960), omega: 24, phase: 'bash wind-up' };
        return { pose: bashPose(g, 'drive', t - 1260), omega: 44, phase: 'bash!' };
      },
    };
  }
  if (move === 'taunt') return { len: 2600, sample: (t) => (t < 300 || t > 2000 ? at(t) : { pose: tauntPose(g, fig.taunt, t - 300), omega: 12, phase: `challenge (${fig.taunt})` }) };
  if (move === 'highGuard') return { len: 2000, sample: (t) => (t < 300 ? at(t) : { pose: pose(g, STATES.highGuard), omega: 9, phase: 'high guard: open to ← →' }) };
  if (move === 'lowGuard') return { len: 2000, sample: (t) => (t < 300 ? at(t) : { pose: pose(g, STATES.lowGuard), omega: 9, phase: 'low guard: open to ↓ ↑' }) };
  if (move === 'shieldBlock') return { len: 1600, sample: (t) => (t > 300 && t < 620 ? { pose: pose(g, fig.off && fig.off !== 'holly' ? STATES.shieldBlock : STATES.bladeBlock), omega: 30, phase: 'takes your cut' } : at(t)) };
  if (move === 'lock') return { len: 2200, sample: (t) => (t < 300 ? at(t) : { pose: pose(g, STATES.lock), omega: 14, phase: 'blade lock', wobble: 0.4 }) };
  if (move === 'pendragon') {
    return {
      len: 2000,
      sample: (t) => {
        if (t < 300) return at(t);
        if (t < 860) return { pose: pose(g, STATES.pendragon), omega: 10, phase: 'Pendragon: raise' };
        const p = playerSwingPose(g, 'S', Math.min(300, (t - 860) * 0.9));
        return p ? { pose: p, omega: 34, phase: 'Pendragon: strike' } : at(t);
      },
    };
  }
  if (move === 'parried') {
    return {
      len: 2400,
      sample: (t) => {
        if (t < 400) return at(t);
        if (t < 900) return { pose: windupPose(g, 'S', (t - 400) / 700), omega: 24, phase: 'wind-up' };
        return { pose: pose(g, STATES.parried), omega: 22, phase: 'parried!', jolt: t - 900 < 20 };
      },
    };
  }
  if (move === 'staggered') return { len: 2600, sample: (t) => (t < 300 ? at(t) : { pose: pose(g, STATES.staggered), omega: 12, wobble: 1, phase: 'staggered' }) };
  if (move === 'roar') return { len: 2200, sample: (t) => (t < 300 ? at(t) : { pose: pose(g, STATES.roar), omega: 10, phase: 'roar' }) };
  if (move === 'defeat') {
    return {
      len: 3200,
      sample: (t) => {
        if (t < 300) return at(t);
        if (t < 1100) return { pose: pose(g, STATES.kneel), omega: 7, phase: 'kneel' };
        return { pose: pose(g, STATES.collapse), omega: 4, phase: 'collapse' };
      },
    };
  }
  if (move === 'walk') {
    return {
      len: 2600,
      sample: (t) => {
        const u = Math.min(1, t / 1500);
        if (u >= 1) return { ...rest, rootZ: 0, phase: 'arrived' };
        const p = pose(g);
        const s = Math.sin(t * 0.009);
        p.footL[1] += s * 0.28;
        p.footR[1] -= s * 0.28;
        return { pose: p, omega: 7, rootZ: -1.6 * (1 - u), phase: 'walking in' };
      },
    };
  }
  if (move.startsWith('sw:')) {
    const dir = mirrorDir(move.slice(3));
    return {
      len: 1300,
      sample: (t) => {
        const p = t >= 300 ? playerSwingPose(g, dir, t - 300) : null;
        return p ? { pose: p, omega: 30, phase: 'swing' } : at(t);
      },
    };
  }
  if (move === 'block') return { len: 1800, sample: (t) => (t > 300 && t < 1300 ? { pose: pose(g, STATES.block), omega: 24, phase: 'block' } : at(t)) };
  if (move === 'stun') return { len: 1400, sample: (t) => (t > 300 && t < 600 ? { pose: pose(g, STATES.stun), omega: 18, phase: 'hit', jolt: t - 300 < 20 } : at(t)) };
  if (move === 'dead') return { len: 3000, sample: (t) => (t < 300 ? at(t) : { pose: pose(g, STATES.dead), omega: 5, phase: 'death' }) };
  if (move === 'dodgeL' || move === 'dodgeR') {
    const dir = move === 'dodgeL' ? -1 : 1;
    return {
      len: 1400,
      sample: (t) => {
        if (t < 300 || t > 650) return at(t);
        const s = Math.sin((Math.PI * (t - 300)) / 350);
        return {
          pose: pose(g, {
            pelvis: [0, 0.74, 0.02], pelvisRot: [0.15, dir * 0.25, -dir * 0.12], chest: [0.32, dir * 0.4, -dir * 0.42],
            handL: [0.1, 1.32, 0.36], faceL: [-dir * 0.3, 0.1, 1], handR: [-0.32, 0.98, 0.1], bladeR: [-0.2, 0.5, -0.8],
          }),
          omega: 20, rootX: dir * 0.85 * s, phase: 'dodge',
        };
      },
    };
  }
  return { len: 2000, sample: () => rest };
}

// ---------- scene ----------

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1b2130');
scene.fog = new THREE.Fog('#1b2130', 8, 22);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
scene.add(new THREE.HemisphereLight('#9fb2d8', '#3a2a1c', 0.7));
const key = new THREE.DirectionalLight('#ffd7a0', 2.4);
key.position.set(4, 6, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
key.target.position.set(0, 0, -2.4);
scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#a9c8ff', 2.2);
rim.position.set(-2, 3.5, -9);
scene.add(rim);

const tile = document.createElement('canvas');
tile.width = 2;
tile.height = 2;
const tctx = tile.getContext('2d');
tctx.fillStyle = '#8e939b';
tctx.fillRect(0, 0, 2, 2);
tctx.fillStyle = '#3a3e46';
tctx.fillRect(0, 0, 1, 1);
tctx.fillRect(1, 1, 1, 1);
const tileTex = new THREE.CanvasTexture(tile);
tileTex.magFilter = THREE.NearestFilter;
tileTex.wrapS = THREE.RepeatWrapping;
tileTex.wrapT = THREE.RepeatWrapping;
tileTex.repeat.set(10, 10);
tileTex.colorSpace = THREE.SRGBColorSpace;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.85, envMapIntensity: 0.3 }));
floor.rotation.x = -Math.PI / 2;
floor.position.z = -2.4;
floor.receiveShadow = true;
scene.add(floor);

// ---------- figures ----------

function makeNative(def) {
  const model = SkeletonUtils.clone(ASSETS.knight);
  model.scale.setScalar((1.85 * def.size) / 539);
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  const root = new THREE.Group();
  root.add(model);
  scene.add(root);
  const mixer = new THREE.AnimationMixer(model);
  const head = model.getObjectByName('Head');
  return {
    def, native: true, mixer, k: { root, J: { head } }, cloths: [], updateSpheres() {}, anim: null,
    play(clip, time) {
      if (this.clip !== clip) { mixer.stopAllAction(); this.action = mixer.clipAction(clip); this.action.play(); this.clip = clip; }
      this.action.time = time;
      mixer.update(0);
    },
    dispose() { scene.remove(root); },
  };
}

function makeFigure(def) {
  if (def.native) return makeNative(def);
  const k = def.skinned ? buildSkinnedKnight(def.skinned === true ? ASSETS : def.skinned, def.look, def.weapon, def.off, def.size) : buildKnight(def.look, def.weapon, def.off, def.size);
  scene.add(k.root);
  const anim = new Animator(k, def.guard);
  const J = k.J;
  const sp = (r) => ({ c: new THREE.Vector3(), r: r * def.size });
  const spheres = { pelvis: sp(0.21), chest: sp(0.22), thighL: sp(0.1), thighR: sp(0.1), kneeL: sp(0.08), kneeR: sp(0.08) };
  const list = Object.values(spheres);
  const tmp = new THREE.Vector3();
  const updateSpheres = () => {
    J.pelvis.localToWorld(spheres.pelvis.c.set(0, -0.06, 0));
    J.chest.localToWorld(spheres.chest.c.set(0, 0.02, -0.02));
    for (const s of ['L', 'R']) {
      J[`hip${s}`].getWorldPosition(tmp);
      J[`kn${s}`].getWorldPosition(spheres[`knee${s}`].c);
      spheres[`thigh${s}`].c.copy(tmp).lerp(spheres[`knee${s}`].c, 0.5);
    }
  };
  const cloths = [];
  const along = (jnt, x0, x1, y, z, cols) => (c, out) => jnt.localToWorld(out.set(x0 + ((x1 - x0) * c) / (cols - 1), y, z));
  const drape = (map, alpha) => new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.92, envMapIntensity: 0.25, transparent: alpha, alphaTest: alpha ? 0.45 : 0 });
  const L = def.look;
  if (L.leafy) {
    cloths.push(new Cloth({ cols: 9, rows: 12, width: 1.0, height: 1.55, material: drape(drapeTex('#3f7a35', null, null, null, 'leaf', true), true), pin: along(J.chest, 0.36, -0.36, 0.21, -0.12, 9), colliders: () => list }));
    cloths.push(new Cloth({ cols: 7, rows: 5, width: 0.6, height: 0.45, material: drape(drapeTex('#3f7a35', null, null, null, 'leaf', true), true), pin: along(J.chest, -0.3, 0.3, 0.22, 0.14, 7), colliders: () => list }));
  } else if (L.cape) {
    cloths.push(new Cloth({ cols: 7, rows: 10, width: 0.54, height: 1.2, material: drape(drapeTex(L.cape, L.trim, L.capeCharge, L.chargeColor, 'cape')), pin: along(J.chest, 0.21, -0.21, 0.19, -0.15, 7), colliders: () => list }));
  }
  cloths.forEach((c) => scene.add(c.mesh));
  return {
    def, k, anim, cloths, updateSpheres,
    dispose() {
      scene.remove(k.root);
      cloths.forEach((c) => scene.remove(c.mesh));
    },
  };
}

let subject = null;
let partner = null;
let figIndex = 0;
let move = 'guard';
let timeline = moveTimeline(FIGURES[0], 'guard');
let t = 0;
let playing = true;
let speed = 1;
let view = 'game';
let orbit = { yaw: 0.6, pitch: 0.12, dist: 3.4 };

function placeFigures() {
  const def = FIGURES[figIndex];
  subject?.dispose();
  partner?.dispose();
  subject = makeFigure(def);
  const partnerDef = def.player || def.native ? FIGURES.find((f) => f.id === 'black') : FIGURES[0];
  partner = makeFigure(partnerDef);
  const [me, them] = def.player ? [subject, partner] : [partner, subject];
  me.k.root.position.set(0, 0, PLAYER_Z);
  me.k.root.rotation.y = Math.PI;
  them.k.root.position.set(0, 0, ENEMY_Z);
  them.k.root.rotation.y = 0.12;
  subject.home = subject.k.root.position.clone();
  partner.home = partner.k.root.position.clone();
  partner.k.root.visible = view === 'game';
  partner.cloths.forEach((c) => { c.mesh.visible = view === 'game'; });
}

// ---------- UI ----------

const $ = (id) => document.getElementById(id);
const figSel = $('figure');
FIGURES.forEach((f, i) => figSel.append(new Option(f.name, i)));
figSel.onchange = () => { figIndex = Number(figSel.value); buildMoves(); placeFigures(); setMove(movesFor(FIGURES[figIndex])[0][0]); };

function button(parent, label, on, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  if (on) b.classList.add('on');
  b.onclick = () => { [...parent.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); onClick(); };
  parent.append(b);
  return b;
}

function movesFor(fig) {
  if (fig.native) return ASSETS.knight.animations.map((a) => [a.name, a.name.replace('HumanArmature|', '')]);
  return fig.player ? PLAYER_MOVES : ENEMY_MOVES;
}

function buildMoves() {
  const bar = $('moves');
  bar.innerHTML = '';
  const list = movesFor(FIGURES[figIndex]);
  list.forEach(([id, label]) => button(bar, label, id === move, () => setMove(id)));
}

function setMove(id) {
  move = id;
  timeline = moveTimeline(FIGURES[figIndex], id);
  t = 0;
  [...$('moves').children].forEach((b, i) => {
    const list = movesFor(FIGURES[figIndex]);
    b.classList.toggle('on', list[i][0] === id);
  });
}

[['game', 'Game cam'], ['front', 'Front'], ['side', 'Side'], ['back', 'Back']].forEach(([id, label]) => button($('views'), label, id === view, () => {
  view = id;
  orbit = { yaw: { front: 0, side: Math.PI / 2, back: Math.PI, game: 0.6 }[id], pitch: 0.12, dist: 3.4 };
  partner.k.root.visible = view === 'game';
  partner.cloths.forEach((c) => { c.mesh.visible = view === 'game'; });
}));
[[1, '1×'], [0.5, '½×'], [0.25, '¼×'], [0.1, '⅒×']].forEach(([v, label]) => button($('speeds'), label, v === speed, () => { speed = v; }));

$('play').onclick = () => {
  playing = !playing;
  $('play').textContent = playing ? '❚❚' : '▶';
  $('play').classList.toggle('on', playing);
};
$('time').oninput = (e) => {
  playing = false;
  $('play').textContent = '▶';
  $('play').classList.remove('on');
  t = (Number(e.target.value) / 1000) * timeline.len;
};

// Drag to orbit (outside the game camera).
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; });
window.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('pointermove', (e) => {
  if (!drag || view === 'game') return;
  orbit.yaw -= (e.clientX - drag.x) * 0.008;
  orbit.pitch = Math.max(-0.3, Math.min(1.2, orbit.pitch + (e.clientY - drag.y) * 0.006));
  drag = { x: e.clientX, y: e.clientY };
});

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- loop ----------

const lookTmp = new THREE.Vector3();
let last = performance.now();
let fresh = true;

function tick(now) {
  const real = Math.min(50, now - last);
  last = now;
  const dt = playing ? real * speed : 0;
  if (playing) t = (t + dt) % timeline.len;
  $('time').value = String(Math.round((t / timeline.len) * 1000));
  const s = timeline.sample(t);
  $('label').textContent = `${s.phase || ''} · ${Math.round(t)} ms`;

  for (const fig of [subject, partner]) {
    const isSubject = fig === subject;
    if (fig.native) {
      fig.play(timeline.native, t / 1000);
      continue;
    }
    const smp = isSubject ? s : { pose: fig.def.guard, omega: 8 };
    fig.anim.set(smp.pose, smp.omega);
    if (!playing || fresh) fig.anim.snap(smp.pose);
    else fig.anim.update(dt / 1000);
    if (isSubject && smp.jolt) fig.anim.jolt(-3, 1, 0);
    const home = fig.home;
    fig.k.root.position.set(home.x + (smp.rootX || 0), 0, home.z + (fig.def.player ? 0 : -(smp.rootZ || 0)) + (fig.def.player ? 0 : 0));
    if (!fig.def.player && smp.rootZ) fig.k.root.position.z = home.z + smp.rootZ;
    const other = fig === subject ? partner : subject;
    fig.anim.apply(other.k.J.head.getWorldPosition(lookTmp), { breathe: 1, wobble: smp.wobble || 0, time: now });
    if (fig.k.retarget) fig.k.retarget();
    fig.updateSpheres();
    fig.cloths.forEach((c) => (fresh ? c.reset() : c.update(dt / 1000)));
  }
  fresh = false;

  const focus = subject.k.root.position;
  if (view === 'game') {
    camera.position.set(2.2, 1.65, PLAYER_Z + 2.0);
    camera.lookAt(-0.75, 1.32, ENEMY_Z);
  } else {
    const c = new THREE.Vector3(focus.x, (orbit.y ?? 1.05) * subject.def.size, focus.z);
    const dir = subject.def.player ? -1 : 1;
    camera.position.set(
      c.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist * dir,
      c.y + Math.sin(orbit.pitch) * orbit.dist,
      c.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist * dir,
    );
    camera.lookAt(c);
  }
  renderer.render(scene, camera);
}

function loop(now) {
  tick(now);
  requestAnimationFrame(loop);
}

buildMoves();
placeFigures();
requestAnimationFrame(loop);
// Debug: render a move at several times into one contact sheet (for review without real-time playback).
function sheet(moveId, times, cam = { yaw: 0.6, pitch: 0.12, dist: 3.2, y: 1.05 }, cols = 4) {
  setMove(moveId);
  playing = false;
  view = 'orbit';
  orbit = cam;
  partner.k.root.visible = false;
  partner.cloths.forEach((c) => { c.mesh.visible = false; });
  const w = 320;
  const h = 240;
  const out = document.createElement('canvas');
  out.width = w * cols;
  out.height = h * Math.ceil(times.length / cols);
  const ctx = out.getContext('2d');
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  playing = true;
  speed = 1;
  t = 0;
  fresh = true;
  let prev = 0;
  times.forEach((tm, i) => {
    // advance the springs through real time so the sheet matches playback
    while (prev < tm) {
      const stepMs = Math.min(16, tm - prev);
      prev += stepMs;
      t = prev - stepMs;
      tick(last + stepMs);
    }
    ctx.drawImage(renderer.domElement, (i % cols) * w, Math.floor(i / cols) * h, w, h);
    ctx.fillStyle = '#f6dc8a';
    ctx.font = '600 16px system-ui';
    ctx.fillText(`${tm} ms`, (i % cols) * w + 8, Math.floor(i / cols) * h + 20);
  });
  playing = false;
  resize();
  let img = document.getElementById('sheet');
  if (!img) {
    img = document.createElement('img');
    img.id = 'sheet';
    img.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000;z-index:9';
    img.onclick = () => img.remove();
    document.body.append(img);
  }
  img.src = out.toDataURL('image/jpeg', 0.85);
}

window.__lab = { get subject() { return subject; }, sheet, setMove, get t() { return t; }, set t(v) { t = v; }, step: (ms) => tick(last + ms), FIGURES, select: (i) => { figIndex = i; figSel.value = i; buildMoves(); placeFigures(); setMove('guard'); }, setView: (v) => { view = v; orbit = { yaw: { front: 0, side: Math.PI / 2, back: Math.PI, game: 0.6 }[v], pitch: 0.12, dist: 3.4 }; partner.k.root.visible = v === 'game'; partner.cloths.forEach((c) => { c.mesh.visible = v === 'game'; }); }, pause: () => { playing = false; }, orbit: (yaw, pitch, dist, y) => { view = 'orbit'; orbit = { yaw, pitch, dist, y }; partner.k.root.visible = false; partner.cloths.forEach((c) => { c.mesh.visible = false; }); } };
