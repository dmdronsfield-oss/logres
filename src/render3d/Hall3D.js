import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { Reflector } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/objects/Reflector.js';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/OutputPass.js';
import { VIEW, PALETTE, CONFIG } from '../config.js';
import { ES } from '../combat/Enemy.js';
import { PS } from '../combat/Player.js';
import { drawCharge } from '../art/Heraldry.js';
import { World3D, P } from './View3D.js';
import { buildKnight } from './knight/Knight.js';
import { loadQuaternius, loadInkxo, buildSkinnedKnight } from './knight/Skinned.js';
import { loadPaladin, loadGreenKnight, buildPaladin, cutFrame } from './knight/Paladin.js';
import { Animator, GUARD, STATES, pose, mirrorDir, windupPose, strikePose, recoverPose, playerSwingPose, bashPose, tauntPose, styleFor } from './knight/Motion.js';
import { DIR_VEC } from '../input/SwipeInput.js';
import { BladeTrail } from './Trail.js';
import { PLAYER_LOOK, lookFor } from './knight/Looks.js';
import { comfort } from '../ui/Comfort.js';

// Third-person duel in Camelot's great hall, staged like Infinity Blade: the
// camera rides over your knight's shoulder, the challenger faces you, and both
// are sculpted, armoured figures driven by IK poses, springs and cloth.
// Combat code is shared with the other views; the enemy's proxies still carry
// its lunge and fade, but its body is animated here from its state.

const DEG = Math.PI / 180;
const ENEMY_Z = -3.4;
const PLAYER_Z = -1.4;
const MID_Z = (ENEMY_Z + PLAYER_Z) / 2;
const K = 0.0048;                 // metres per logical pixel for enemy pose offsets
const FOV = 42;
// Over the right shoulder, aimed at the challenger's chest (Infinity Blade framing).
const CAM = { x: 2.2, y: 1.65, back: 2.0, lookX: -0.75, lookY: 1.32 };
// Upright phones: higher and further back, a taller lens, both knights in the middle band.
const CAM_P = { x: 1.75, y: 2.1, back: 3.2, lookX: -0.05, lookY: 1.12 };
const FOV_P = 58;
const ENEMY_TURN = 0.12;
const RELEASE_MS = 90;             // the blow leaves the wind-up this long before impact
const REFLECT = 1;                // render layer seen by the floor's reflection
const QUALITY_KEY = 'logres.quality';
const NO_ANIM = { set() {}, update() {}, jolt() {}, apply() {}, target: null };
const smooth = (x) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
const easeOut = (x) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 2;


// ---------- deterministic randomness and hall textures ----------

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

function css([r, g, b], f = 1) {
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${cl(r)},${cl(g)},${cl(b)})`;
}

function pix(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

const texCache = new Map();

function noiseTex(hex, kind = 'cloth') {
  const key = `${hex}|${kind}`;
  if (texCache.has(key)) return texCache.get(key);
  const base = rgb(hex);
  const r = rng(hex.length * 131 + kind.length * 17 + base[0]);
  const size = kind === 'stone' ? 64 : 32;
  const t = pix(size, size, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let f = 0.9 + r() * 0.14;
        if (kind === 'wood') f *= y % 6 === 0 ? 0.8 : 1;
        if (kind === 'gold') f *= 1.1 - (y / h) * 0.25;
        if (kind === 'stone') {
          const row = Math.floor(y / 16);
          const off = row % 2 ? 16 : 0;
          if (y % 16 === 0 || (x + off) % 32 === 0) f = 0.6;
          else f *= 0.92 + ((Math.floor((x + off) / 32) * 7 + row * 3) % 5) * 0.035;
        }
        ctx.fillStyle = css(base, f);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
  t.userData.keep = true;
  texCache.set(key, t);
  return t;
}

function glowTex() {
  if (texCache.has('glow')) return texCache.get('glow');
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,236,190,1)');
  g.addColorStop(0.25, 'rgba(255,190,100,0.55)');
  g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.userData.keep = true;
  texCache.set('glow', t);
  return t;
}

// ---------- the view ----------

export class HallView extends World3D {
  constructor(game) {
    super(game);
    this.cam = 'side';
    this.tourney = true;
    this.scene.remove(this.hemi, this.sun, this.sun.target);
    this.camera.children.filter((c) => c.isLight).forEach((c) => this.camera.remove(c));
    this.fov = VIEW.portrait ? FOV_P : FOV;
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    let q = 2;
    try { q = Number(localStorage.getItem(QUALITY_KEY) ?? 2); } catch (e) { /* ignore */ }
    this.quality = Number.isFinite(q) ? Math.max(0, Math.min(2, q)) : 2;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, [1, 1.25, 1.5][this.quality]);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.35, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    const C = VIEW.portrait ? CAM_P : CAM;
    this.camTarget = new THREE.Vector3(C.lookX, C.lookY, ENEMY_Z);
    this.camHome = new THREE.Vector3(C.x, C.y, PLAYER_Z + C.back);
    this.cheer = 0;
    this.time = 0;
    this.perf = { frames: 0, total: 0, last: 0 };
    // The player is Sir Gawain in INKXO's rigged knight armour (falls back to
    // the code-built knight if the model can't load). On the model preview the
    // challengers use the CC0 Quaternius knight too.
    // Gawain and his foes are the Paladin, played from motion capture; INKXO's knight if it can't load.
    this.ready = Promise.all([
      loadPaladin((ev) => window.__loadProgress?.((ev.loaded / (ev.total || ev.loaded || 1)) * 0.9, 'Arming Sir Gawain…'))
        .then((a) => { this.paladin = a; })
        // The Green Knight is his own man: loaded after the Paladin, and only needed in the last round.
        .then(() => { loadGreenKnight().then((a) => { this.greenKnight = a; }).catch((err) => console.warn('Green Knight failed to load', err)); })
        .catch((err) => {
          console.warn('Paladin failed to load', err);
          return loadInkxo(this.quality < 2).then((a) => { this.hero = a; }).catch((e2) => console.warn('Player model failed to load', e2));
        }),
      window.LOGRES_MODEL === 'quaternius' ? loadQuaternius().then((a) => { this.skinned = a; }) : null,
    ]);
    this.fovKick = 0;
  }

  syncCanvas(force = false) {
    const gc = this.game.canvas;
    const key = `${gc.offsetLeft},${gc.offsetTop},${gc.offsetWidth},${gc.offsetHeight},${this.pixelRatio}`;
    if (!force && key === this.lastRect) return;
    this.lastRect = key;
    this.canvas.style.left = `${gc.offsetLeft}px`;
    this.canvas.style.top = `${gc.offsetTop}px`;
    const w = gc.offsetWidth || 1;
    const h = gc.offsetHeight || 1;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.camera.aspect = VIEW.W / VIEW.H;
    this.camera.updateProjectionMatrix();
  }

  // 2 = everything; 1 = no bloom; 0 = no bloom, no reflections, no shadows, lower resolution.
  applyQuality() {
    const q = this.quality;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, [1, 1.25, 1.5][q]);
    if (this.mirror) this.mirror.visible = q > 0;
    if (this.floor) {
      this.floor.material.opacity = q > 0 ? 0.74 : 1;
      this.floor.material.transparent = q > 0;
    }
    this.renderer.shadowMap.enabled = q > 0;
    this.lastRect = '';
  }

  // Step quality down if the phone can't hold ~45 fps.
  // Player's choice from the pause menu (manual = stop stepping it down automatically).
  setQuality(q, manual = false) {
    this.quality = Math.max(0, Math.min(2, q));
    try {
      localStorage.setItem(QUALITY_KEY, String(this.quality));
      if (manual) localStorage.setItem(`${QUALITY_KEY}.manual`, '1');
    } catch (e) { /* ignore */ }
    if (manual) this.manualQuality = true;
    this.applyQuality();
    this.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  }

  _watchPerformance(now) {
    const p = this.perf;
    if (this.manualQuality === undefined) {
      try { this.manualQuality = localStorage.getItem(`${QUALITY_KEY}.manual`) === '1'; } catch (e) { this.manualQuality = false; }
    }
    if (this.manualQuality) return;
    if (p.last) {
      const d = now - p.last;
      if (d < 200) {
        p.frames += 1;
        if (p.frames > 60) p.total += d;
      }
    }
    p.last = now;
    if (p.frames >= 150) {
      const avg = p.total / (p.frames - 60);
      if (avg > 22 && this.quality > 0) {
        this.quality -= 1;
        try { localStorage.setItem(QUALITY_KEY, String(this.quality)); } catch (e) { /* ignore */ }
        this.applyQuality();
        this.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
      }
      p.frames = 0;
      p.total = 0;
    }
  }

  box(w, h, d, mat, x, y, z, parent, cast = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    parent.add(m);
    return m;
  }

  std(hex, kind = 'cloth', extra = {}) {
    const rough = { plate: 0.38, mail: 0.5, stone: 0.9, wood: 0.8, leaf: 0.9, gold: 0.35 }[kind] ?? 0.86;
    const metal = { plate: 0.5, mail: 0.3, gold: 0.8 }[kind] ?? 0;
    return new THREE.MeshStandardMaterial({ map: noiseTex(hex, kind), roughness: rough, metalness: metal, envMapIntensity: 0.35, ...extra });
  }

  canvasW() { return this.game.canvas.offsetWidth || window.innerWidth; }

  canvasH() { return this.game.canvas.offsetHeight || window.innerHeight; }

  // ---------- the great hall ----------

  buildEnv() {
    const g = new THREE.Group();
    this.content.add(g);
    const r = rng(1066);
    this.scene.background = new THREE.Color('#151a26');
    this.scene.fog = new THREE.FogExp2('#20263a', 0.032);
    const lights = [];

    // Cool window light with shadows; warm key from the camera side; dim fill.
    lights.push(new THREE.HemisphereLight('#94a8d0', '#4a3424', 0.95));
    const win = new THREE.DirectionalLight('#cddcff', 1.3);
    win.position.set(-7, 9, 0);
    win.target.position.set(0, 0, MID_Z);
    win.castShadow = true;
    win.shadow.mapSize.set(1024, 1024);
    Object.assign(win.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 25 });
    win.shadow.bias = -0.0015;
    win.shadow.normalBias = 0.02;
    const key = new THREE.DirectionalLight('#ffcf95', 2.2);
    key.position.set(5, 4, 5);
    key.target.position.set(0, 1, MID_Z);
    // Cool rim light from beyond the challenger picks out both knights' silhouettes.
    const rim = new THREE.DirectionalLight('#a9c8ff', 2.6);
    rim.position.set(-1.5, 3.5, -9);
    rim.target.position.set(0, 1.2, MID_Z);
    lights.push(win, key, rim);
    g.add(win.target, key.target, rim.target);

    const stone = this.std('#7a7c86', 'stone');
    const stoneDark = this.std('#585a64', 'stone');
    const wood = this.std('#4a2f1e', 'wood');
    const goldM = this.std(PALETTE.goldCss, 'gold');

    // Wet marble floor: a half-resolution mirror under a translucent checkerboard.
    const mirror = new Reflector(new THREE.PlaneGeometry(16, 30), {
      clipBias: 0.003,
      textureWidth: Math.round(this.canvasW() * this.pixelRatio * 0.5),
      textureHeight: Math.round(this.canvasH() * this.pixelRatio * 0.5),
      color: 0x8c909a,
      multisample: 0,
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.set(0, -0.002, -5);
    mirror.camera.layers.set(REFLECT);
    g.add(mirror);
    this.mirror = mirror;
    const tile = pix(2, 2, (ctx) => {
      ctx.fillStyle = '#8e939b';
      ctx.fillRect(0, 0, 2, 2);
      ctx.fillStyle = '#3a3e46';
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillRect(1, 1, 1, 1);
    }, [8, 15]);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 30),
      new THREE.MeshStandardMaterial({ map: tile, roughness: 0.85, metalness: 0.0, envMapIntensity: 0.25, transparent: true, opacity: 0.74 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -5);
    floor.receiveShadow = true;
    g.add(floor);
    this.floor = floor;

    // Walls and ceiling.
    this.box(0.6, 11, 30, stoneDark, -7.6, 5.5, -5, g, false);
    this.box(0.6, 11, 30, stoneDark, 7.6, 5.5, -5, g, false);
    this.box(16, 11, 0.6, stoneDark, 0, 5.5, -13.9, g, false);
    this.box(16, 0.4, 30, this.std('#24242c', 'wood'), 0, 10.6, -5, g, false);

    // Tall windows on the left wall, with shafts of light falling across the hall.
    const glass = new THREE.MeshBasicMaterial({ color: '#d6e4ff' });
    const rayTex = (() => {
      const c = document.createElement('canvas');
      c.width = 4;
      c.height = 64;
      const ctx = c.getContext('2d');
      const gr = ctx.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, 'rgba(210,225,255,0.9)');
      gr.addColorStop(1, 'rgba(210,225,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 4, 64);
      return new THREE.CanvasTexture(c);
    })();
    const shaft = new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    [-2.4, -8.2].forEach((z) => {
      this.box(0.1, 4.6, 1.5, glass, -7.26, 5.4, z, g, false);
      this.box(0.14, 0.12, 1.6, stone, -7.2, 5.4, z, g, false);
      this.box(0.14, 4.7, 0.12, stone, -7.2, 5.4, z, g, false);
      this.box(0.3, 0.3, 1.9, stone, -7.2, 7.8, z, g, false);
      for (let i = 0; i < 2; i++) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(1.4 - i * 0.5, 10), shaft);
        s.position.set(-4.3 + i * 0.3, 3.1, z + i * 0.3);
        s.rotation.set(0, Math.PI / 2, 0.66);
        g.add(s);
      }
    });

    // Pillars and arches.
    const pillarZ = [2.6, -1.4, -5.4, -9.4];
    for (const sx of [-1, 1]) {
      for (const z of pillarZ) {
        const x = sx * 5.0;
        if (sx > 0 && z > -2) continue;   // keep the camera's side clear
        this.box(0.95, 8.6, 0.95, stone, x, 4.3, z, g);
        this.box(1.3, 0.45, 1.3, stoneDark, x, 0.22, z, g);
        this.box(1.3, 0.35, 1.3, stoneDark, x, 8.7, z, g);
      }
      this.box(0.95, 0.8, 16, stoneDark, sx * 5.0, 9.2, -4, g, false);
    }

    // Banners: blue lions and green stags with gold fringe.
    const banner = (field, charge) => pix(24, 72, (ctx, w, h) => {
      ctx.fillStyle = field;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = PALETTE.goldCss;
      ctx.fillRect(0, 0, w, 3);
      ctx.fillRect(0, 0, 1, h);
      ctx.fillRect(w - 1, 0, 1, h);
      ctx.fillRect(2, 5, w - 4, 1);
      drawCharge(ctx, charge, w / 2, 26, 20, PALETTE.goldCss, null);
      ctx.clearRect(0, h - 10, w, 10);
      for (let x = 0; x < w; x++) {
        const d = Math.abs(x - w / 2);
        const len = 10 - Math.round((d / (w / 2)) * 10);
        ctx.fillStyle = field;
        ctx.fillRect(x, h - 10, 1, len);
        if (len > 0) {
          ctx.fillStyle = PALETTE.goldCss;
          ctx.fillRect(x, h - 10 + len - 1, 1, 1);
        }
      }
    });
    const bannerMats = [
      new THREE.MeshStandardMaterial({ map: banner('#24387a', 'lion'), roughness: 0.9, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ map: banner('#24502a', 'stag'), roughness: 0.9, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    ];
    this.banners = [];
    let bi = 0;
    const hang = (x, y, z, ry, w = 1.15, h = 3.4) => {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), bannerMats[bi++ % 2]);
      b.position.set(x, y, z);
      b.rotation.y = ry;
      b.userData.phase = r() * 6;
      g.add(b);
      this.banners.push(b);
    };
    for (const sx of [-1, 1]) {
      for (const z of pillarZ) {
        if (sx > 0 && z > -2) continue;
        hang(sx * 4.45, 5.8, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
    }
    hang(-4.0, 6.0, -13.5, 0, 1.3, 4.2);
    hang(4.0, 6.0, -13.5, 0, 1.3, 4.2);

    // The great tapestry of the tree, framed in gold, over the high table.
    const tap = pix(56, 52, (ctx, w, h) => {
      const tr = rng(7);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          ctx.fillStyle = css(rgb('#1f3b25'), 0.88 + tr() * 0.2);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.fillStyle = '#b98a2c';
      ctx.fillRect(2, 2, w - 4, 1);
      ctx.fillRect(2, h - 3, w - 4, 1);
      ctx.fillRect(2, 2, 1, h - 4);
      ctx.fillRect(w - 3, 2, 1, h - 4);
      ctx.fillStyle = '#c99a3a';
      ctx.fillRect(27, 16, 2, 30);
      ctx.fillRect(21, 26, 14, 2);
      ctx.fillRect(25, 44, 6, 2);
      for (let i = 0; i < 110; i++) {
        const a = tr() * Math.PI * 2;
        const d = Math.sqrt(tr()) * 13;
        ctx.fillStyle = tr() > 0.4 ? '#c99a3a' : '#8a6a24';
        ctx.fillRect(Math.round(28 + Math.cos(a) * d * 1.3), Math.round(15 + Math.sin(a) * d * 0.75), 2, 2);
      }
      drawCharge(ctx, 'stag', 10, 36, 15, '#c99a3a', null);
      drawCharge(ctx, 'stag', 46, 36, 15, '#c99a3a', null);
      ctx.fillStyle = '#c99a3a';
      [[9, 10], [47, 10], [9, 22], [47, 22]].forEach(([x, y]) => { ctx.fillRect(x - 1, y - 3, 2, 7); ctx.fillRect(x - 3, y - 1, 7, 2); });
    });
    const tapestry = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 5.9), new THREE.MeshStandardMaterial({ map: tap, roughness: 0.95 }));
    tapestry.position.set(0, 5.0, -13.55);
    g.add(tapestry);
    this.box(6.8, 0.18, 0.15, goldM, 0, 8.0, -13.5, g, false);
    this.box(6.8, 0.12, 0.12, goldM, 0, 2.0, -13.5, g, false);
    this.box(7.2, 2.6, 0.1, this.std('#5c1a1e'), 0, 1.55, -13.5, g, false);

    // Dais, high table and the royal couple.
    this.box(11, 0.22, 3.6, stoneDark, 0, 0.11, -11.9, g);
    this.box(11, 0.44, 2.6, stoneDark, 0, 0.22, -12.4, g);
    this.box(11, 0.66, 1.6, stoneDark, 0, 0.33, -12.9, g);
    this.box(5.4, 0.8, 0.9, wood, 0, 1.06, -12.2, g);
    this.box(5.5, 0.55, 0.05, this.std('#7a2025'), 0, 0.98, -11.73, g);
    const royal = (x, robe, crownH) => {
      const p = new THREE.Group();
      p.position.set(x, 0.66, -12.75);
      this.box(0.52, 0.78, 0.34, this.std(robe), 0, 0.86, 0, p);
      [-1, 1].forEach((s) => this.box(0.13, 0.5, 0.14, this.std(robe), s * 0.32, 0.88, 0.05, p));
      this.box(0.24, 0.26, 0.24, this.std('#e2b48a'), 0, 1.4, 0, p);
      this.box(0.26, 0.1, 0.26, this.std('#5a3a20'), 0, 1.5, -0.01, p);
      this.box(0.28, crownH, 0.28, goldM, 0, 1.57 + crownH / 2 - 0.04, 0, p);
      this.box(1.0, 1.9, 0.16, wood, 0, 0.95, -0.32, p);
      this.box(1.05, 0.12, 0.2, goldM, 0, 1.95, -0.32, p);
      g.add(p);
    };
    royal(-0.65, '#2b3f8a', 0.12);
    royal(0.65, '#7a2a5a', 0.08);

    // Branched candelabras with flickering warm lights and glowing flames.
    this.candles = [];
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
    const glowMat = new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    const haloMat = glowMat.clone();
    haloMat.opacity = 0.35;
    const waxMat = this.std('#efe6cf');
    const iron = this.std('#2a2522', 'plate');
    [[-3.0, -9.6], [3.0, -9.6], [-3.4, -4.2], [3.3, -5.6]].forEach(([x, z], i) => {
      const c = new THREE.Group();
      c.position.set(x, 0, z);
      this.box(0.46, 0.08, 0.46, iron, 0, 0.04, 0, c);
      this.box(0.22, 0.14, 0.22, iron, 0, 0.14, 0, c);
      this.box(0.07, 2.1, 0.07, iron, 0, 1.12, 0, c);
      this.box(1.0, 0.05, 0.05, iron, 0, 1.9, 0, c);
      this.box(0.6, 0.05, 0.05, iron, 0, 2.18, 0, c);
      const spots = [[-0.48, 1.9], [-0.24, 1.9], [0.24, 1.9], [0.48, 1.9], [-0.28, 2.18], [0.28, 2.18], [0, 2.3]];
      spots.forEach(([dx, hgt]) => {
        this.box(0.06, 0.16, 0.06, waxMat, dx, hgt + 0.1, 0, c, false);
        const fl = this.box(0.035, 0.07, 0.035, flameMat, dx, hgt + 0.22, 0, c, false);
        fl.layers.enable(REFLECT);
        const s = new THREE.Sprite(glowMat);
        s.scale.setScalar(0.32);
        s.position.set(dx, hgt + 0.23, 0);
        s.layers.enable(REFLECT);
        c.add(s);
      });
      const halo = new THREE.Sprite(haloMat);
      halo.scale.setScalar(1.6);
      halo.position.set(0, 2.15, 0);   // (kept out of the floor reflection: it blooms into glare)
      c.add(halo);
      const light = new THREE.PointLight('#ffa64f', i < 2 ? 16 : 11, 10, 2);
      light.position.set(0, 2.2, 0.2);
      c.add(light);
      lights.push(light);
      this.candles.push({ light, base: light.intensity, phase: i * 1.7 });
      g.add(c);
    });

    lights.forEach((l) => {
      l.layers.enable(REFLECT);   // the mirror needs lights too
      if (!l.parent) g.add(l);
    });

    this._crowd(g, r);
    this._mergeStatic(g);
    this._captureEnvironment();
    this.applyQuality();
  }

  // Merge the hall's static meshes per material to save draw calls.
  _mergeStatic(g) {
    const skip = new Set([this.mirror, this.floor, ...(this.banners || [])]);
    const groups = new Map();
    g.updateMatrixWorld(true);
    for (const o of [...g.children]) {
      // Recurse into props built as groups (candelabras, the royal couple).
      if (!o.isMesh && !o.isLight && o.children.length && !o.isInstancedMesh) this._mergeStatic(o);
      if (!o.isMesh || o.isInstancedMesh || skip.has(o) || Array.isArray(o.material)) continue;
      if (!groups.has(o.material)) groups.set(o.material, []);
      groups.get(o.material).push(o);
    }
    for (const [mat, meshes] of groups) {
      if (meshes.length < 2) continue;
      const geos = meshes.map((m) => {
        const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
        for (const n of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(n)) geo.deleteAttribute(n);
        return geo;
      });
      const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
      merged.receiveShadow = true;
      merged.layers.mask = meshes.reduce((m, o) => m | o.layers.mask, 0);
      meshes.forEach((m) => { g.remove(m); m.geometry.dispose(); });
      g.add(merged);
    }
  }

  // Bake the hall into a reflection map so armour reflects candles and windows.
  _captureEnvironment() {
    if (this.envRT) this.envRT.dispose();
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.mirror.visible = false;
    this.content.position.set(0, -1.5, 2.4);
    this.envRT = pm.fromScene(this.scene, 0.03, 0.1, 60);
    this.content.position.set(0, 0, 0);
    this.mirror.visible = true;
    this.scene.environment = this.envRT.texture;
    pm.dispose();
  }

  // Spectators: knights and courtiers built from instanced blocks.
  _crowd(g, r) {
    const spots = [];
    for (const sx of [-1, 1]) {
      for (let z = 3; z > -10.5; z -= 0.7) {
        if (sx > 0 && z > -2.8) continue;
        for (let row = 0; row < 2; row++) {
          if (r() < 0.22) continue;
          spots.push({ x: sx * (5.75 + row * 0.75 + r() * 0.2), z: z + r() * 0.3, ry: (sx > 0 ? -Math.PI / 2 : Math.PI / 2) + (r() - 0.5) * 0.6, h: 0.92 + r() * 0.14 });
        }
      }
    }
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 5; i++) spots.push({ x: sx * (3.2 + i * 0.62), z: -10.4 - (i % 2) * 0.45, ry: sx * 0.3, h: 0.95 + r() * 0.1 });
    }
    const n = spots.length;
    const mk = (w, h, d, hex, kind = 'cloth') => {
      const m = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), this.std(hex, kind), n);
      g.add(m);
      return m;
    };
    const parts = {
      legs: mk(0.32, 0.82, 0.22, '#3a3330'),
      body: mk(0.46, 0.62, 0.27, '#ffffff'),
      arms: mk(0.62, 0.48, 0.2, '#ffffff', 'mail'),
      head: mk(0.22, 0.24, 0.22, '#e2b48a'),
      hat: mk(0.25, 0.1, 0.25, '#ffffff'),
    };
    const tunic = ['#2b4a9b', '#7a2a2a', '#3f6a35', '#6a5a3a', '#2b4a9b', '#8a6a2a', '#5a2a5a', '#24387a'].map((c) => new THREE.Color(c));
    const sleeves = ['#9aa0aa', '#7a6a5a', '#8a8f99'].map((c) => new THREE.Color(c));
    const hats = ['#3b2716', '#c8892e', '#1a1a1a', '#9aa0aa', '#9aa0aa', '#2b4a9b'].map((c) => new THREE.Color(c));
    spots.forEach((s, i) => {
      parts.body.setColorAt(i, tunic[Math.floor(r() * tunic.length)]);
      parts.arms.setColorAt(i, sleeves[Math.floor(r() * sleeves.length)]);
      parts.hat.setColorAt(i, hats[Math.floor(r() * hats.length)]);
      s.phase = r() * 10;
    });
    this.crowd = { spots, parts, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1) };
    this._updateCrowd(0);
  }

  _updateCrowd(t) {
    const c = this.crowd;
    if (!c) return;
    const parts = c.parts;
    c.spots.forEach((s, i) => {
      const jump = this.cheer * Math.abs(Math.sin(t * 0.012 + s.phase));
      const bob = jump * 0.14 + Math.sin(t * 0.002 + s.phase) * 0.008;
      c.q.setFromEuler(c.e.set(0, s.ry, 0));
      const put = (mesh, y) => {
        c.m.compose(c.v.set(s.x, (y + bob) * s.h, s.z), c.q, c.one);
        mesh.setMatrixAt(i, c.m);
      };
      put(parts.legs, 0.41);
      put(parts.body, 1.12);
      put(parts.arms, 1.16 + jump * 0.12);
      put(parts.head, 1.57);
      put(parts.hat, 1.71);
    });
    Object.values(parts).forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  }

  // ---------- figures ----------

  // Build a knight with its animator, cloth and collision spheres.
  _figure(look, weaponKind, offhandKind, size, guard, { front = true, back = true, assets = this.skinned } = {}) {
    const k = assets && assets.kind === 'paladin' ? buildPaladin(assets, look, weaponKind, offhandKind, size)
      : assets ? buildSkinnedKnight(assets, look, weaponKind, offhandKind, size) : buildKnight(look, weaponKind, offhandKind, size);
    this.content.add(k.root);
    const anim = k.clips ? NO_ANIM : new Animator(k, guard);
    const J = k.J;
    const bs = (k.bodyScale || 1) * size;
    const sp = (r) => ({ c: new THREE.Vector3(), r: r * bs });
    const spheres = { pelvis: sp(0.21), chest: sp(0.22), thighL: sp(0.1), thighR: sp(0.1), kneeL: sp(0.08), kneeR: sp(0.08), shinL: sp(0.075), shinR: sp(0.075) };
    const list = Object.values(spheres);
    const tmp = new THREE.Vector3();
    const updateSpheres = () => {
      J.pelvis.localToWorld(spheres.pelvis.c.set(0, -0.06, 0));
      J.chest.localToWorld(spheres.chest.c.set(0, 0.02, -0.02));
      for (const s of ['L', 'R']) {
        J[`hip${s}`].getWorldPosition(tmp);
        J[`kn${s}`].getWorldPosition(spheres[`knee${s}`].c);
        spheres[`thigh${s}`].c.copy(tmp).lerp(spheres[`knee${s}`].c, 0.5);
        J[`ft${s}`].getWorldPosition(tmp);
        spheres[`shin${s}`].c.copy(spheres[`knee${s}`].c).lerp(tmp, 0.5);
      }
    };
    const cloths = [];   // no capes or cloaks
    k.root.traverse((o) => { if (o.isMesh) o.layers.enable(REFLECT); });
    return { k, anim, cloths, updateSpheres, guard, look };
  }

  buildEnemy(def) {
    const look = lookFor(def);
    const giant = def.weapon === 'greataxe';
    // Plate knights wear INKXO's harness, recoloured; the others stay code-built.
    const assets = (def.id === 'green' && this.greenKnight) || this.paladin || (look.model === 'inkxo' && this.hero ? this.hero : this.skinned);
    look.foe = true;
    const f = this._figure(look, def.weapon, def.offhand, def.size || 1, giant ? GUARD.giant : GUARD.ss, { assets });
    f.k.root.position.set(0, 0, ENEMY_Z);
    f.k.root.rotation.y = ENEMY_TURN;
    const prox = { root: new P(), body: new P(), head: new P(), armL: new P(), armR: new P(), weapon: new P() };
    this.enemy = { ...f, prox, hp: null, walkPhase: 0, lastZ: null, fade: 1, zoff: 0, zvel: 0, flashUntil: 0, glow: 0 };
    this.enemy.trail = new BladeTrail(this.content, { color: 0xffe7a0, from: 0.84, over: 0.06, inner: 0.35, tail: 1.8, life: 120 });
    const view = this;
    const { k } = f;
    prox.root.flash = (ms) => {
      view.enemy.flashUntil = performance.now() + ms + 25;
      k.mats.forEach((m) => m.emissive && m.emissive.setRGB(0.6, 0.6, 0.55));
      setTimeout(() => k.mats.forEach((m) => m.emissive && m.emissive.setRGB(0, 0, 0)), ms + 25);
    };
    return {
      ...prox,
      weaponLen: k.weaponLen / K,
      setWeaponTint(c) {
        k.weaponMats.forEach((m) => (c === null ? m.emissive.setRGB(0, 0, 0) : m.emissive.setRGB(0.9, 0.06, 0.02)));
      },
      tip(frac = 1) { return view.project(k.weaponObj.localToWorld(view.v.set(0, -k.weaponLen * frac, 0))); },
      headPoint() { return view.project(k.J.head.localToWorld(view.v.set(0, 0.3, 0))); },
      chestPoint() { return view.project(k.J.chest.localToWorld(view.v.set(0, 0.05, 0.2))); },
    };
  }

  buildPlayer(sword, shield) {
    // The arsenal: Clarent gilded, Excalibur shining; the Kite is Gawain's own lion
    // heater, Pridwen a blue heater with gold crowns, the Targe a round wooden one.
    const look = {
      ...PLAYER_LOOK, blade: sword.color, shield: shield.field, shieldCharge: shield.id === 'pridwen' ? shield.charge : 'lion',
      swordId: sword.id, modelShield: shield.id === 'kite', shieldTint: { pridwen: '#5a78d8', targe: '#a07850' }[shield.id],
    };
    const f = this._figure(look, 'sword', shield.id === 'targe' ? 'round' : 'heater', 1, GUARD.hero, { back: false, assets: this.paladin || this.hero || this.skinned });
    f.k.root.position.set(0, 0, PLAYER_Z);
    f.k.root.rotation.y = Math.PI;
    this.player = { body3d: true, ...f, hp: null, zoff: 0, zvel: 0 };
    // Your own blade is close to the lens: a fainter, shorter trail.
    this.player.trailColor = { excalibur: 0xd8eeff, clarent: 0xf0c878 }[sword.id] || 0xa8c4ff;
    // Your cut leaves a thin, bright streak along the tip's path, as in Infinity Blade.
    this.player.trail = new BladeTrail(this.content, {
      color: this.player.trailColor, minSpeed: 4, life: sword.id === 'excalibur' ? 110 : 90, from: 0.86, over: 0.08, gain: 2.0, inner: 0.35, tail: 1.8,
    });
    // The Pendragon's light: a gold lamp at the blade during the super.
    this.player.superLight = new THREE.PointLight(0xffd27a, 0, 7, 1.6);
    this.content.add(this.player.superLight);
    const W = VIEW.W;
    const H = VIEW.H;
    const swordHome = { x: W / 2 + W * 0.3, y: H + 20, angle: 8 };
    const shieldHome = { x: W / 2 - W * 0.31, y: H + 40, angle: 6 };
    const view = this;
    return {
      swordArm: new P(swordHome.x, swordHome.y), shield: new P(shieldHome.x, shieldHome.y), swordHome, shieldHome, side: 1,
      chestPoint() { return view.project(f.k.J.chest.localToWorld(view.v.set(0, 0.2, 0))); },
    };
  }

  // ---------- animation ----------

  _syncEnemy(e, dt) {
    const v = this.enemy;
    if (!v) return;
    const r = v.prox;
    const { k, anim, guard } = v;
    const fwd = r.root.scaleX / e.size - 1;
    const z = ENEMY_Z + fwd * 4;
    k.root.position.set((r.root.x - e.baseX) * K, 0, z);
    // Walking: legs step while the root travels (the walk in, lunges).
    const speed = v.lastZ === null || dt <= 0 ? 0 : Math.abs(z - v.lastZ) / (dt / 1000);
    v.lastZ = z;
    const walking = speed > 0.4 && e.state === ES.INTRO;
    if (walking) v.walkPhase += dt * 0.009;

    let target = guard;
    let omega = 7;
    let wobble = 0;
    const dir = e.attack ? e.attack.direction : 'S';
    const style = v.style || (v.style = styleFor(e.def.weapon));
    // Weight and distance: he sinks back to load, lunges in to strike, is driven back when hurt.
    let zWant = 0;
    let zRate = 7;
    switch (e.state) {
      case ES.TELEGRAPH: {
        const rem = e.telegraphTotal - e.t;
        // The blow is released just before impact, so the blade meets your parry on screen.
        const bash = e.attack && e.attack.bash;
        if (rem < RELEASE_MS && !e.feintAt) {
          const ms = ((RELEASE_MS - rem) / RELEASE_MS) * 110;
          target = bash ? bashPose(guard, 'drive', ms) : strikePose(guard, dir, ms, style); omega = 48; zWant = bash ? 0.5 : 0.4; zRate = 22;
        } else {
          const u = Math.min(1, e.visualT() / Math.max(1, e.visualTotal() - RELEASE_MS));
          target = bash ? bashPose(guard, 'wind', u) : windupPose(guard, dir, u, style); omega = 24; zWant = bash ? -0.25 : -0.14; zRate = 3;
        }
        break;
      }
      case ES.STRIKE:
        target = e.attack && e.attack.bash ? bashPose(guard, 'drive', 110 + e.t) : strikePose(guard, dir, 110 + e.t, style);
        omega = 40; zWant = e.attack && e.attack.bash ? 0.52 : 0.45; zRate = 22; break;
      case ES.GAP: target = strikePose(guard, dir, 380 + e.t, style); omega = 14; zWant = 0.25; break;
      case ES.FEINT: omega = 16; zWant = -0.1; break;
      case ES.RECOVER: target = e.gloating ? tauntPose(guard, e.def.taunt, e.t) : recoverPose(guard, dir, e.t, style); omega = 18; zWant = e.t < 300 ? 0.3 : 0; zRate = 3; break;
      case ES.PARRIED:
        if (e.disarmed) {
          // Disarmed: thrown back empty-handed, a stagger, then he reaches for his weapon.
          const left = e.openDur - e.t;
          if (e.t < 260) { target = pose(guard, STATES.parried); omega = 26; zWant = -0.3; zRate = 14; }
          else if (left > 1000 || !v.disarm) { target = pose(guard, STATES.staggered); omega = 9; wobble = 0.6; zWant = -0.3; zRate = 4; }
          else {
            target = pose(guard);
            target.handR = v.disarm.hand.slice();
            target.chest = [0.38, 0.35, -0.1];
            target.pelvis = [target.pelvis[0], target.pelvis[1] - 0.12, target.pelvis[2]];
            omega = 10; zWant = 0; zRate = 3;
          }
          break;
        }
        target = pose(guard, STATES.parried); omega = 26; zWant = -0.4; zRate = 14; break;
      case ES.STAGGERED: target = pose(guard, STATES.staggered); omega = 12; wobble = 1; zWant = -0.3; zRate = 5; break;
      case ES.INTERLUDE: target = pose(guard, STATES.roar); omega = 10; break;
      case ES.INTRO: {
        // Walk in, then his challenge, then into guard.
        const t0 = e.introMs * 0.52;
        if (e.t > t0 && e.t < e.introMs * 0.9) { target = tauntPose(guard, e.def.taunt, e.t - t0); omega = 12; }
        break;
      }
      case ES.IDLE: {
        if (e.usesStances && e.stance) { target = pose(guard, e.stance === 'high' ? STATES.highGuard : STATES.lowGuard); omega = 9; }
        // Life between blows: weight rocks from foot to foot, and now and then he resets his feet.
        const rate = e.def.restless || 1;
        const tt = this.time / 1000;
        target = pose(target);
        const sway = Math.sin(tt * 1.3 * rate + (v.phase || (v.phase = Math.random() * 6)));
        target.pelvis[0] += sway * 0.035;
        target.pelvis[1] -= Math.abs(sway) * 0.008;
        target.chest[2] += sway * 0.04;
        const beat = Math.floor(tt * 0.45 * rate);
        const r1 = Math.sin(beat * 12.9898) * 43758.5453;
        const jitter = (r1 - Math.floor(r1)) - 0.5;
        if (beat % 2) target.footL[1] += jitter * 0.08;
        else target.footR[1] += jitter * 0.08;
        // Your swipe clanged: he visibly takes it on his shield or his blade.
        if (e.flinchAt && performance.now() - e.flinchAt < 320) {
          target = pose(target, e.def.offhand && e.def.offhand !== 'holly' ? STATES.shieldBlock : STATES.bladeBlock); omega = 30;
        }
        break;
      }
      case ES.LOCKED: {
        // The struggle shows in the gap: his weight comes on as he wins, goes back as he loses.
        const lv = this.duel && this.duel.director.lock ? this.duel.director.lock.v : 0.5;
        target = pose(guard, STATES.lock); omega = 14; zWant = 0.5 - (lv - 0.5) * 0.9; zRate = 8; wobble = 0.4;
        if (Math.random() < 0.3) anim.jolt((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 0);
        break;
      }
      case ES.DEFEATED:
        if (e.rises && e.t > 1500) { target = pose(guard, STATES.roar); omega = 5; zWant = -0.2; zRate = 2; }
        else { target = pose(guard, e.t < 800 ? STATES.kneel : STATES.collapse); omega = e.t < 800 ? 7 : 4; zWant = -0.35; zRate = 4; }
        break;
      default: break;
    }
    if (walking) {
      target = pose(target);
      const s = Math.sin(v.walkPhase);
      target.footL[1] += s * 0.28;
      target.footR[1] -= s * 0.28;
    }
    // Slipping away from your cuts: a hop back.
    if (e.hopAt && e.hopAt !== v.hopSeen) { v.hopSeen = e.hopAt; v.zvel -= 3.2; }
    // Critically damped step toward the wanted distance.
    const sdt = dt / 1000;
    const ez = Math.exp(-zRate * sdt);
    const zy = v.zoff - zWant;
    const ztv = v.zvel + zRate * zy;
    v.zoff = zWant + (zy + ztv * sdt) * ez;
    v.zvel = (v.zvel - zRate * ztv * sdt) * ez;
    k.root.position.z += v.zoff;
    anim.set(target, omega);
    anim.update(dt / 1000);
    // Wind-up tremble while holding at the top of the blow.
    if (e.state === ES.TELEGRAPH && e.t > e.telegraphTotal * 0.6) anim.jolt((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15, 0);
    // A hesitation is held dead still, which is what makes it readable.
    if (e.state === ES.TELEGRAPH && e.attack && e.attack.hesitate && e.visualT() !== e.t && e.visualT() === (e.telegraphTotal - e.attack.hesitate[1]) * e.attack.hesitate[0]) anim.set(anim.target, 60);
    if (v.hp !== null && e.health < v.hp) {
      // Knocked the way your blade travelled (his +x is your screen-right).
      const pl = this.playerState;
      const [dx, dy] = (pl && DIR_VEC[pl.swingDir]) || [0, 0];
      // High cuts snap the head back and aside; level cuts twist the trunk round.
      const high = Math.abs(dy) > 0.6;
      anim.jolt(-2.4 + dy * 3, dx * (high ? 2.5 : 5), -dx * 2.8, high ? -6 - dy * 2 : -1.5, dx * (high ? 7 : 2));
      v.hitAt = this.gameT;
      v.hits = (v.hits || 0) + 1;
      v.zvel -= 1.6;
      this.camPunch = 1;
      this.cheer = 1;
    }
    if (e.state === ES.PARRIED && e.t < 30) anim.jolt(-3.5, 1.5, 0);
    v.hp = e.health;
    this._disarm(v, e, dt);
    const look = this.player ? this.player.k.J.head.getWorldPosition(this.v2 || (this.v2 = new THREE.Vector3())) : null;
    if (k.clips) this._clipEnemy(v, e, dt, walking);
    else {
      anim.apply(look, { breathe: e.state === ES.DEFEATED ? 0 : 1, wobble, time: this.time });
      if (k.retarget) k.retarget();
    }
    v.updateSpheres();
    v.cloths.forEach((c) => c.update(dt / 1000));
    // Trails belong to blows only (not gloats, guards or stumbles).
    const blow = e.state === ES.TELEGRAPH || e.state === ES.STRIKE || e.state === ES.GAP;
    this._trail(v, !blow ? null : (e.attack && !e.attack.parryable ? 0xff5a3c : 0xffc860));
    this._wear(v, e.healthFrac);
    // Gold shimmer while he is open: the moment to strike.
    const now = performance.now();
    const openNow = e.isOpen() && e.state !== ES.DEFEATED;
    // The glow fades as the opening runs out, and flickers when he's about to recover early.
    const wantGlow = openNow ? 0.35 + 0.65 * e.openFraction() : 0;
    v.glow += (wantGlow - v.glow) * Math.min(1, dt / 120);
    if (now > v.flashUntil && (v.glow > 0.01 || v.glowWas)) {
      const flick = e.openWarn ? 0.35 + 0.65 * Math.abs(Math.sin(now / 45)) : 1;
      const g = v.glow * flick * (0.16 + Math.sin(now / 110) * 0.06) * (v.look && v.look.tint ? 0.45 : 1);
      k.mats.forEach((m) => m.emissive && m.emissive.setRGB(g, g * 0.75, g * 0.25));
      v.glowWas = v.glow > 0.01;
    }

    const a = r.root.alpha;
    if (Math.abs(a - v.fade) > 0.001) {
      v.fade = a;
      const all = [k.root, ...v.cloths.map((c) => c.mesh)];
      all.forEach((root) => root.traverse((o) => {
        if (!o.material) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.transparent = a < 0.999 || m.alphaTest > 0; m.opacity = a; });
      }));
    }
  }

  // Disarmed: his weapon spins out of his hand, falls point-first and sticks in the
  // floor beside him; when he takes it up it's back in his grip.
  _disarm(v, e, dt) {
    const k = v.k;
    const w = k.weaponObj;
    const on = e.state === ES.PARRIED && e.disarmed && e.openDur - e.t > 380;
    let d = v.disarm;
    if (on && !d) {
      w.updateMatrixWorld(true);
      const base = w.localToWorld(new THREE.Vector3());
      const len = base.distanceTo(w.localToWorld(new THREE.Vector3(0, -k.weaponLen, 0)));
      d = v.disarm = { parent: w.parent, p: w.position.clone(), q: w.quaternion.clone(), s: w.scale.clone(), t: 0 };
      this.content.attach(w);
      d.from = w.position.clone();
      d.q0 = w.quaternion.clone();
      // Where it lands: off to his left (the open side of the screen), within reach, sunk a fifth of its length.
      const rq = k.root.getWorldQuaternion(new THREE.Quaternion());
      const hilt = k.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.72, 0, 0.12).applyQuaternion(rq));
      hilt.y = len * 0.8;
      d.land = this.content.worldToLocal(hilt.clone());
      const hand = k.root.worldToLocal(hilt.clone());
      d.hand = [hand.x, hand.y, hand.z];
      // Point down (the blade runs along -y), leaning a little.
      d.qEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.14, Math.random() * Math.PI * 2, 0.1, 'YXZ'));
      d.axis = new THREE.Vector3().subVectors(d.land, d.from).setY(0).cross(new THREE.Vector3(0, 1, 0)).normalize();
      if (d.axis.lengthSq() < 0.5) d.axis.set(1, 0, 0);
    }
    if (!d) return;
    if (on) {
      d.t += dt / 1000;
      const u = Math.min(1, d.t / 0.85);
      w.position.lerpVectors(d.from, d.land, u);
      w.position.y += 4 * 1.3 * u * (1 - u);
      const spin = new THREE.Quaternion().setFromAxisAngle(d.axis, u * Math.PI * 4.5).multiply(d.q0);
      const settle = Math.max(0, Math.min(1, (u - 0.65) / 0.35));
      w.quaternion.copy(spin).slerp(d.qEnd, settle * settle * (3 - 2 * settle));
    } else {
      d.parent.add(w);
      w.position.copy(d.p);
      w.quaternion.copy(d.q);
      w.scale.copy(d.s);
      v.disarm = null;
    }
  }

  _syncPlayerBody(pl, dt) {
    const v = this.player;
    if (!v || !pl) return;
    const { k, anim, guard } = v;
    const now = performance.now();
    let target = guard;
    let omega = 9;
    let rootX = 0;
    switch (pl.state) {
      case PS.DODGING: {
        const s = Math.sin(Math.PI * Math.min(1, pl.stateT / CONFIG.dodge.durationMs));
        const dir = pl.dodgeSide === 'left' ? -1 : 1;
        rootX = dir * 0.85 * s;
        // A crouched side-step: shoulders turned away from the blow, shield up, sword tucked.
        target = pose(guard, {
          pelvis: [0, 0.74, 0.02], pelvisRot: [0.15, dir * 0.25, -dir * 0.12], chest: [0.32, dir * 0.4, -dir * 0.42],
          handL: [0.1, 1.32, 0.36], faceL: [-dir * 0.3, 0.1, 1], handR: [-0.32, 0.98, 0.1], bladeR: [-0.2, 0.5, -0.8],
        });
        omega = 20;
        break;
      }
      case PS.BLOCKING: target = pose(guard, STATES.block); omega = 24; break;
      case PS.STUNNED: target = pose(guard, STATES.stun); omega = 18; break;
      case PS.DEAD: target = pose(guard, STATES.dead); omega = 5; break;
      default: break;
    }
    // Your swing: coil, cut along the swipe with follow-through, back to guard.
    this.playerState = pl;
    // Timed by the swing itself, so the blade arrives exactly when the hit lands (contactMs).
    const t = pl.state === PS.ATTACKING ? pl.stateT : 1e9;
    if (pl.state === PS.ATTACKING && pl.swingDir) {
      const sw = playerSwingPose(guard, mirrorDir(pl.swingDir), t);
      if (sw) { target = sw; omega = 70; }   // tight tracking: the clip, not the springs, shapes the cut
    }
    const lock = this.duel && this.duel.director.lock;
    if (lock) { target = pose(guard, STATES.lock); omega = 14; }
    // Strike of the Pendragon: sword raised high and blazing, then brought down.
    const sfx = this.duel && this.duel.director.superFx;
    const st = sfx ? now - sfx.at : 1e9;
    if (st < 1000) {
      if (st < 560) { target = pose(guard, STATES.pendragon); omega = 10; }
      else { target = playerSwingPose(guard, 'S', Math.min(300, (st - 560) * 0.9)) || guard; omega = 34; }
    }
    k.root.position.x = rootX;
    // Step into your cut (toward him is -z); recoil off his guard on a clang.
    let zWant = lock ? -0.3 - (lock.v - 0.5) * 0.35 : 0;
    // Weight back onto the rear foot in the wind-up, then the body drives forward into the cut.
    if (!lock && t >= 0 && t < 400 && pl.swingDir && pl.state !== PS.DEAD) zWant = t < 150 ? 0.08 : -0.26;
    if (pl.state === PS.STUNNED) zWant = 0.25;
    const sdt = dt / 1000;
    v.zoff += (zWant - v.zoff) * Math.min(1, sdt * (zWant < v.zoff ? 18 : 7));
    if (pl.clangAt && now - pl.clangAt < 40 && !v.clangDone) {
      v.clangDone = true;
      anim.jolt(2.6, (Math.random() - 0.5) * 3, 0);
      v.zoff += 0.12;
    }
    if (pl.clangAt && now - pl.clangAt >= 40) v.clangDone = false;
    k.root.position.z = PLAYER_Z + v.zoff;
    anim.set(target, omega);
    anim.update(dt / 1000);
    if (v.hp !== null && pl.health < v.hp) {
      // Struck: thrown back, twisted with the blow's direction of travel.
      const ad = this.duel && this.duel.enemy.attack ? DIR_VEC[this.duel.enemy.attack.direction] || [0, 0.3] : [0, 0.3];
      anim.jolt(-5.5 - ad[1] * 2, -ad[0] * 4, ad[0] * 3);
      v.hitAt = this.gameT;
      v.hits = (v.hits || 0) + 1;
      v.zoff += 0.25;
      this.camHurt = 1;
    }
    // Shield struck: braced jolt and a half step back.
    if (v.pips !== undefined && pl.pips < v.pips && pl.state === PS.BLOCKING) { anim.jolt(-2.6, 0, 0); v.zoff += 0.14; }
    v.pips = pl.pips;
    v.hp = pl.health;
    const look = this.enemy ? this.enemy.k.J.head.getWorldPosition(this.v3 || (this.v3 = new THREE.Vector3())) : null;
    if (k.clips) this._clipPlayer(v, pl, dt, lock, st);
    else {
      anim.apply(look, { breathe: pl.state === PS.DEAD ? 0 : 1, time: now });
      if (k.retarget) k.retarget();
    }
    v.updateSpheres();
    v.cloths.forEach((c) => c.update(dt / 1000));
    // The streak marks the cut itself: from the draw-back to the far side, not the wind-up or the return.
    const cutting = pl.state === PS.ATTACKING && pl.stateT >= (k.clips ? 110 : 140) && pl.stateT <= (k.clips ? 270 : 250);
    this._trail(v, pl.state === PS.DEAD || lock || !cutting ? null : v.trailColor);
    this._superGlow(v);
    this._wear(v, pl.healthFrac);
  }

  // ---------- the Paladin's clips ----------

  // A knight's clip for this moment. Blows are scrubbed to the combat clock: the
  // contact frame of the clip lands exactly when the game lands the blow.
  _clipEnemy(v, e, dt, walking) {
    const C = v.k.clips;
    const S = v.k.set;
    const T = this.gameT / 1000;
    const dir = e.attack ? e.attack.direction : 'S';
    const [cut, rev] = e.attack && e.attack.bash ? [S.bash, false] : S.foe[dir] || S.foe.S;
    // Each blow of a combination starts its clip afresh.
    if (e.state === ES.TELEGRAPH && v.lastState !== ES.TELEGRAPH) v.blow = (v.blow || 0) + 1;
    v.lastState = e.state;
    const key = `${cut}${v.blow}`;
    const idle = () => C.show(S.idle, (T * (e.def.restless || 1)) % C.dur(S.idle), 0.3);
    const hit = v.hitAt !== undefined && this.gameT - v.hitAt < 420;
    switch (e.state) {
      case ES.TELEGRAPH: {
        const rem = e.telegraphTotal - e.t;
        let p;
        if (rem < RELEASE_MS && !e.feintAt) p = 1 + ((RELEASE_MS - rem) / RELEASE_MS) ** 1.3;
        else {
          const u = Math.min(1, e.visualT() / Math.max(1, e.visualTotal() - RELEASE_MS));
          // Quickly up, then held at the top, trembling.
          p = easeOut(u * 1.25) + (u > 0.6 ? Math.sin(this.time / 37) * 0.012 : 0);
        }
        C.frame(cut, cutFrame(cut, rev, p, S.cuts), rev ? 0.25 : 0.14, key);
        break;
      }
      case ES.STRIKE: {
        const c = S.cuts[cut];
        const span = Math.abs(rev ? c.a - c.c : c.e - c.c) / 30 * 1000;
        C.frame(cut, cutFrame(cut, rev, 2 + Math.min(1, e.t / span), S.cuts), 0.1, key);
        break;
      }
      case ES.GAP: C.frame(cut, cutFrame(cut, rev, 3, S.cuts), 0.1, key); break;
      case ES.PARRIED:
      case ES.STAGGERED: {
        // Thrown back off your parry; each of your cuts while he's open rocks him again.
        if (hit) C.show(S.hits[v.hits % 2], (this.gameT - v.hitAt) / 1000 * 1.2, 0.06, `hit${v.hits}`);
        else if (e.t < C.dur(S.parried) * 1000 * 0.75) C.show(S.parried, e.t / 1000 * 1.1, 0.08, `parried${v.blow}`);
        else C.show(S.guard, T % C.dur(S.guard), 0.3);
        break;
      }
      case ES.LOCKED: C.show(S.guard, T % C.dur(S.guard), 0.2); break;
      case ES.INTERLUDE: C.show(S.taunt, e.t / 1000, 0.3); break;
      case ES.INTRO: {
        const t0 = e.introMs * 0.52;
        if (walking) C.show(S.walk, (T * 1.1) % C.dur(S.walk), 0.2);
        else if (e.t > t0 && e.t < e.introMs * 0.9) C.show(S.taunt, (e.t - t0) / 1000 * 1.2, 0.3);
        else idle();
        break;
      }
      case ES.DEFEATED:
        if (e.rises && e.t > 1500) C.show(S.taunt, (e.t - 1500) / 1000, 0.5);
        else C.show(S.death, e.t / 1000, 0.15);
        break;
      default:
        if (hit) C.show(S.hits[v.hits % 2], (this.gameT - v.hitAt) / 1000 * 1.2, 0.06, `hit${v.hits}`);
        else if (e.state === ES.IDLE && e.flinchAt && performance.now() - e.flinchAt < 320) C.show(S.flinch, (performance.now() - e.flinchAt) / 1000 * 1.5, 0.06, `flinch${e.flinchAt}`);
        else idle();
    }
    C.update(dt / 1000);
    v.k.root.updateMatrixWorld(true);
  }

  _clipPlayer(v, pl, dt, lock, st) {
    const C = v.k.clips;
    const T = this.gameT / 1000;
    const hit = v.hitAt !== undefined && this.gameT - v.hitAt < 380;
    if (pl.state === PS.BLOCKING && v.lastPl !== PS.BLOCKING) v.blockT = T;
    if (pl.state === PS.DODGING && v.lastPl !== PS.DODGING) v.dodges = (v.dodges || 0) + 1;
    v.lastPl = pl.state;
    if (st < 1000) {
      // Strike of the Pendragon: the power-up, then an overhead blow.
      if (st < 560) C.show('power_up', (st / 560) * 1.3, 0.15, 'pendragon');
      else C.frame('overhead', cutFrame('overhead', false, 1 + Math.min(2, (st - 560) / 150)), 0.1, `pendragon-cut${this.duel.director.superFx.at}`);
    } else if (lock) C.show('block_idle', T % C.dur('block_idle'), 0.2);
    else if (pl.state === PS.ATTACKING && pl.swingDir) {
      const [cut, rev] = v.k.set.player[pl.swingDir] || v.k.set.player.S;
      const t = pl.stateT;
      const A = CONFIG.player.attackMs;
      const H = CONFIG.player.contactMs;
      // Wind-up 0-100 ms, the cut 100 ms to contact, the follow-through to the end of the swing.
      const p = t < 100 ? smooth(t / 100) : t < H ? 1 + ((t - 100) / (H - 100)) ** 1.4 : 2 + easeOut((t - H) / (A - H));
      if (pl !== v.swingOf || t < v.swingT) v.swing = (v.swing || 0) + 1;
      v.swingOf = pl;
      v.swingT = t;
      C.frame(cut, cutFrame(cut, rev, p), rev ? 0.08 : 0.1, `${cut}${v.swing}`);
    } else if (pl.state === PS.DODGING) {
      // A side-step away and back.
      const u = Math.min(1, pl.stateT / CONFIG.dodge.durationMs);
      const away = pl.dodgeSide === 'left' ? 'strafe3' : 'strafe4';
      const back = pl.dodgeSide === 'left' ? 'strafe4' : 'strafe3';
      if (u < 0.5) C.show(away, u * 2 * C.dur(away), 0.06, `dodge${v.dodges}`);
      else C.show(back, (u - 0.5) * 2 * C.dur(back), 0.08, `dodgeback${v.dodges}`);
    } else if (pl.state === PS.BLOCKING) {
      // Shield brought up, then held.
      const b = T - v.blockT;
      if (b < C.dur('block')) C.show('block', b, 0.06, `block${v.blockT}`);
      else C.show('block_idle', b % C.dur('block_idle'), 0.1);
    }
    else if (pl.state === PS.STUNNED) C.show('impact2', pl.stateT / 1000, 0.08);
    else if (pl.state === PS.DEAD) C.show('death2', pl.stateT / 1000, 0.15);
    else if (hit) C.show(v.hits % 2 ? 'impact' : 'impact3', (this.gameT - v.hitAt) / 1000 * 1.2, 0.06, `hit${v.hits}`);
    else C.show('idle', T % C.dur('idle'), 0.2);
    C.update(dt / 1000);
    v.k.root.updateMatrixWorld(true);
  }

  // Battle wear: at two-thirds and one-third health the armour darkens and dulls a step.
  _wear(v, frac) {
    const stage = frac < 1 / 3 ? 2 : frac < 2 / 3 ? 1 : 0;
    if (!(stage > (v.wear || 0))) return;
    for (let s = (v.wear || 0); s < stage; s++) {
      v.k.mats.forEach((m) => {
        if (m.color) m.color.multiplyScalar(0.86);
        if (m.roughness !== undefined) m.roughness = Math.min(1, m.roughness + 0.12);
      });
    }
    v.wear = stage;
  }

  // The super's light on the blade (and on the hall around it).
  _superGlow(v) {
    const sfx = this.duel && this.duel.director.superFx;
    const t = sfx ? performance.now() - sfx.at : 1e9;
    const g = t < 1100 ? (t < 560 ? t / 560 : Math.max(0, 1 - (t - 560) / 540)) : 0;
    if (!v.baseEmissive) v.baseEmissive = v.k.weaponMats.map((m) => (m.emissive ? m.emissive.clone() : null));
    if (g > 0 || v.glowing) {
      v.k.weaponMats.forEach((m, i) => {
        if (!m.emissive) return;
        if (g > 0) m.emissive.setRGB(g * 1.1, g * 0.8, g * 0.3);
        else if (v.baseEmissive[i]) m.emissive.copy(v.baseEmissive[i]);
      });
      v.glowing = g > 0;
    }
    if (v.superLight) {
      v.superLight.intensity = g * 6;
      if (g > 0) v.k.weaponObj.localToWorld(v.superLight.position.set(0, -v.k.weaponLen * 0.7, 0));
    }
  }

  _trail(v, color) {
    if (!v.trail) return;
    if (color === null) { v.trail.hide(); return; }
    const { k } = v;
    if (!this._tb) { this._tb = new THREE.Vector3(); this._tt = new THREE.Vector3(); }
    k.weaponObj.updateMatrixWorld(true);
    const base = k.weaponObj.localToWorld(this._tb.set(0, 0, 0));
    const tip = k.weaponObj.localToWorld(this._tt.set(0, -k.weaponLen, 0));
    v.trail.setColor(color);
    v.trail.update(base, tip, this.gameT);
  }

  // ---------- per-frame ----------

  render(duel, dt) {
    this.duel = duel;
    this.syncCanvas();
    const now = performance.now();
    this.time = now;
    this.gameT = (this.gameT || 0) + dt;   // game time (slows with slow motion; steps with the test harness)
    this._watchPerformance(now);
    const cam = this.camera;
    const px = this.player ? this.player.k.root.position.x : 0;
    cam.position.copy(this.camHome);
    cam.position.x += px * 0.55;
    cam.position.y += Math.sin(now / 1900) * 0.012;
    // Tension: creep in while he winds up; punch in on your hits; jolt when you're struck.
    const ee = duel.enemy;
    let push = 0;
    if (ee && ee.state === ES.TELEGRAPH) push = Math.min(1, ee.t / ee.telegraphTotal) * 0.22;
    this.camPush = (this.camPush || 0) + (push - (this.camPush || 0)) * Math.min(1, (dt || 16) / (push > (this.camPush || 0) ? 400 : 90));
    this.camPunch = (this.camPunch || 0) * Math.exp(-(dt || 16) / 90);
    this.camHurt = (this.camHurt || 0) * Math.exp(-(dt || 16) / 140);
    // Comfort mode: no pushes, punches or jolts.
    const calm = comfort();
    if (!calm) {
      cam.position.z -= this.camPush + this.camPunch * 0.12;
      cam.position.x += this.camHurt * 0.08 * Math.sin(now / 17);
      cam.position.y -= this.camHurt * 0.05;
    }
    const sh = duel.cameras.main.shakeEffect;
    if (sh && sh.isRunning && !comfort()) {
      cam.position.x += (sh._offsetX || 0) * 0.004;
      cam.position.y += (sh._offsetY || 0) * 0.004;
    }
    cam.up.set(0, 1, 0);
    const fin = duel.director && duel.director.finisher;
    const fall = duel.director && duel.director.fallen;
    const intro = ee && ee.state === ES.INTRO && ee.introMs > 900 ? 1 - Math.min(1, ee.t / ee.introMs) : 0;
    // Blade lock: ease round into a two-shot so the bind is in view, and back after.
    const locked = !fin && duel.director && duel.director.lock;
    this.lockCam = (this.lockCam || 0) + ((locked ? 1 : 0) - (this.lockCam || 0)) * Math.min(1, (dt || 16) / (locked ? 160 : 260));
    const sfxA = duel.director && duel.director.superFx;
    const sft = sfxA ? now - sfxA.at : 1e9;
    if (calm) {
      // Comfort mode: the camera holds its place for every cinematic moment.
      cam.lookAt(this.camTarget.x + px * 0.25, this.camTarget.y, this.camTarget.z);
    } else if (sft < 1300 && !fin && !fall) {
      // The Pendragon: low and close, looking up at Gawain.
      const s = sft < 300 ? sft / 300 : sft > 950 ? Math.max(0, 1 - (sft - 950) / 350) : 1;
      const e2 = s * s * (3 - 2 * s);
      cam.position.y -= e2 * 0.75;
      cam.position.z -= e2 * 0.5;
      cam.position.x -= e2 * 0.4;
      cam.lookAt(this.camTarget.x * (1 - e2) + px * e2, this.camTarget.y + e2 * 0.55, this.camTarget.z * (1 - e2) + (PLAYER_Z - 0.6) * e2);
    } else if (fall) {
      // Your fall: round to face Gawain as he goes down.
      const u = Math.min(1, (now - fall.at) / 1600);
      const s = u * u * (3 - 2 * u);
      const pv = this._pv || (this._pv = new THREE.Vector3());
      pv.set(px, 0, PLAYER_Z);
      const dx = cam.position.x - pv.x;
      const dz = cam.position.z - pv.z;
      const th = s * 2.2;
      const r = 1 - s * 0.35;
      cam.position.x = pv.x + (dx * Math.cos(th) - dz * Math.sin(th)) * r;
      cam.position.z = pv.z + (dx * Math.sin(th) + dz * Math.cos(th)) * r;
      cam.position.y -= s * 0.75;
      cam.lookAt(px * (1 - s) + this.camTarget.x * (1 - s), this.camTarget.y * (1 - s) + 0.8 * s, this.camTarget.z * (1 - s) + PLAYER_Z * s);
    } else if (intro > 0.001 && !fin) {
      // The entrance: from high and wide over the hall, sweeping down behind Gawain.
      const s = intro * intro * (3 - 2 * intro);
      const piv = this._piv || (this._piv = new THREE.Vector3());
      piv.set(0, 0, MID_Z);
      const dx = cam.position.x - piv.x;
      const dz = cam.position.z - piv.z;
      const th = s * 0.8;
      const r = 1 + s * 0.7;
      cam.position.x = piv.x + (dx * Math.cos(th) - dz * Math.sin(th)) * r;
      cam.position.z = piv.z + (dx * Math.sin(th) + dz * Math.cos(th)) * r;
      cam.position.y += s * 1.4;
      cam.lookAt(this.camTarget.x * (1 - s), this.camTarget.y - s * 0.2, this.camTarget.z);
    } else if (this.lockCam > 0.002 && !fin) {
      const s = this.lockCam * this.lockCam * (3 - 2 * this.lockCam);
      const piv = this._piv || (this._piv = new THREE.Vector3());
      piv.set(-0.2, 0, MID_Z);
      const dx = cam.position.x - piv.x;
      const dz = cam.position.z - piv.z;
      // Upright screens are narrow: a gentler swing that keeps both knights whole.
      const th = -s * (VIEW.portrait ? 0.32 : 0.75);
      const r = 1 - s * (VIEW.portrait ? 0.04 : 0.3);
      cam.position.x = piv.x + (dx * Math.cos(th) - dz * Math.sin(th)) * r;
      cam.position.z = piv.z + (dx * Math.sin(th) + dz * Math.cos(th)) * r;
      cam.position.y -= s * (VIEW.portrait ? 0.05 : 0.2);
      cam.lookAt(this.camTarget.x * (1 - s) - 0.2 * s, this.camTarget.y + s * 0.12, this.camTarget.z * (1 - s) + MID_Z * s);
    } else if (fin) {
      // Kill cam: swing round to the side of the duel and drop a little, on him.
      const u = Math.min(1, (now - fin.at) / 1700);
      const s = u * u * (3 - 2 * u);
      const piv = this._piv || (this._piv = new THREE.Vector3());
      piv.set(-0.2, 0, MID_Z - 0.3);
      const dx = cam.position.x - piv.x;
      const dz = cam.position.z - piv.z;
      // Landscape swings round into profile; an upright screen closes in on him instead.
      const th = -s * (VIEW.portrait ? 0.5 : 1.05);
      const r = 1 - s * (VIEW.portrait ? 0.38 : 0.12);
      cam.position.x = piv.x + (dx * Math.cos(th) - dz * Math.sin(th)) * r;
      cam.position.z = piv.z + (dx * Math.sin(th) + dz * Math.cos(th)) * r;
      cam.position.y -= s * 0.45;
      this.cheer = 1;
      if (VIEW.portrait) cam.lookAt(this.camTarget.x * (1 - s) - 0.15 * s, this.camTarget.y - s * 0.35, this.camTarget.z + s * 0.4);
      else cam.lookAt(this.camTarget.x * (1 - s) - 0.3 * s, this.camTarget.y - s * 0.2, this.camTarget.z + s * 0.95);
    } else {
      cam.lookAt(this.camTarget.x + px * 0.25, this.camTarget.y, this.camTarget.z);
    }
    // A short zoom punch on parries and staggers.
    const e = duel.enemy;
    if (e && ((e.state === ES.PARRIED && e.t < 40) || (e.state === ES.STAGGERED && e.t < 40))) this.fovKick = 7;
    if (e && e.state === ES.LOCKED) this.fovKick = Math.max(this.fovKick, 6 + Math.sin(now / 40) * 0.4);
    if (calm) this.fovKick = 0;
    this.fovKick *= Math.exp(-(dt || 16) / 180);
    cam.fov = this.fov - this.fovKick;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    if (e) {
      this._syncEnemy(e, dt);
      const c = e.rig.chestPoint();
      e.aura.setPosition(c.x - (duel.world ? duel.world.x : 0), c.y - 20);
    }
    this._syncPlayerBody(duel.player, dt);

    (this.candles || []).forEach((c) => {
      c.light.intensity = c.base * (0.88 + Math.sin(now * 0.017 + c.phase) * 0.06 + Math.sin(now * 0.041 + c.phase * 3) * 0.05);
    });
    (this.banners || []).forEach((b) => { b.rotation.z = Math.sin(now * 0.0011 + b.userData.phase) * 0.025; });
    this.cheer = Math.max(0, this.cheer - (dt || 16) / 700);
    this._updateCrowd(now);

    if (this.quality >= 2) this.composer.render();
    else this.renderer.render(this.scene, cam);
  }

  clear() {
    super.clear();
    this.crowd = null;
    this.candles = [];
    this.banners = [];
    this.scene.background = null;
    this.scene.environment = null;
    if (this.envRT) { this.envRT.dispose(); this.envRT = null; }
  }
}
