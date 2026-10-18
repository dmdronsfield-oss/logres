import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { Reflector } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/objects/Reflector.js';
import { VIEW, PALETTE, CONFIG } from '../config.js';
import { ES } from '../combat/Enemy.js';
import { PS } from '../combat/Player.js';
import { DIR_VEC } from '../input/SwipeInput.js';
import { angFor } from '../art/Tex.js';
import { drawCharge } from '../art/Heraldry.js';
import { World3D, P } from './View3D.js';

// Third-person "tourney at Camelot" view: chunky voxel knights with pixel
// textures, fought in a candle-lit great hall, seen over your knight's shoulder.
// Combat code is shared; enemies are still posed through the same proxies.

const DEG = Math.PI / 180;
const ENEMY_Z = -3.3;
const PLAYER_Z = -1.0;
const MID_Z = (ENEMY_Z + PLAYER_Z) / 2;
const HIP = 0.945;
const THIGH = 0.44;
const SHIN = 0.505;               // knee to sole
const K = 0.0048;                 // metres per logical pixel for enemy pose offsets
const FOV = 38;
// Low, close camera behind your knight's sword shoulder, aimed past him at the enemy.
const ORBIT = { angle: 50, dist: 5.2, height: 1.45, lookY: 1.45, lead: 0.45 };
const ENEMY_TURN = 0.32;          // the enemy turns a little toward the camera so his sword arm reads
const MAX_PIXEL_RATIO = 1.5;
const REFLECT = 1;                // render layer seen by the floor's reflection

export const PLAYER_LOOK = {
  tabard: '#24408c', trim: PALETTE.goldCss, charge: 'lion', helm: 'coif', helmColor: '#2e4588',
  mail: '#8e949c', plate: '#a9b0ba', cape: '#2a4796', capeCharge: 'lion', skin: '#e2b48a',
};

// Your knight's guard, matching the reference: lunge, sword forward point-up, shield across.
const GUARD = {
  armR: 14, armRx: -1.15, elbowR: 0.35, wrist: -1.05, weapon: 0,
  armL: 30, armLx: -0.95, elbowL: 1.05,
  bodyA: 0, bodyRx: 0.2, bodyY: 0, twist: -0.18, rootX: 0,
};

// ---------- deterministic randomness and pixel textures ----------

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
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

const texCache = new Map();

// Small noisy pixel texture in the given colour; `kind` picks the pattern.
function noiseTex(hex, kind = 'cloth') {
  const key = `${hex}|${kind}`;
  if (texCache.has(key)) return texCache.get(key);
  const base = rgb(hex);
  const r = rng(hex.length * 131 + kind.length * 17 + base[0]);
  const size = kind === 'stone' ? 32 : 16;
  const t = pix(size, size, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let f = 0.9 + r() * 0.16;
        if (kind === 'mail') f *= ((x + (y % 2)) % 2 ? 0.66 : 1.12) * (y % 3 === 0 ? 0.9 : 1);
        if (kind === 'plate') f *= 1.18 - (y / h) * 0.32 + (x === 3 || x === 4 ? 0.22 : 0) + (r() > 0.95 ? 0.2 : 0);
        if (kind === 'wood') f *= y % 4 === 0 ? 0.75 : 1;
        if (kind === 'leaf') f *= r() > 0.6 ? 1.3 : r() > 0.5 ? 0.68 : 1;
        if (kind === 'gold') f *= 1.1 - (y / h) * 0.25 + (r() > 0.9 ? 0.3 : 0);
        if (kind === 'stone') {
          const row = Math.floor(y / 8);
          const off = row % 2 ? 8 : 0;
          if (y % 8 === 0 || (x + off) % 16 === 0) f = 0.55;
          else f *= 0.92 + ((Math.floor((x + off) / 16) * 7 + row * 3) % 5) * 0.04;
        }
        ctx.fillStyle = css(base, f);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
  t.userData.keep = true;   // shared between duels; never disposed
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
    // Replace the toon lighting with our own per-scene lights.
    this.scene.remove(this.hemi, this.sun, this.sun.target);
    this.camera.children.filter((c) => c.isLight).forEach((c) => this.camera.remove(c));
    this.camera.fov = FOV;
    this.camera.updateProjectionMatrix();
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const q = Number(new URLSearchParams(location.search).get('angle'));
    const a = (q && Math.abs(q) < 90 ? q : ORBIT.angle) * DEG;
    this.camTarget = new THREE.Vector3(0, ORBIT.lookY, MID_Z - ORBIT.lead);
    this.camHome = new THREE.Vector3(Math.sin(a) * ORBIT.dist, ORBIT.height, MID_Z + Math.cos(a) * ORBIT.dist);
    this.cheer = 0;
    this.time = 0;
  }

  // Box helper: w/h/d in metres, positioned in `parent`.
  box(w, h, d, mat, x, y, z, parent, cast = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    parent.add(m);
    return m;
  }

  std(hex, kind = 'cloth', extra = {}) {
    const rough = { plate: 0.38, mail: 0.5, stone: 0.92, wood: 0.8, leaf: 0.9, gold: 0.35 }[kind] ?? 0.86;
    // Low metalness: there's no environment map, so very metallic surfaces would go black.
    const metal = { plate: 0.22, mail: 0.15, gold: 0.3 }[kind] ?? 0;
    return new THREE.MeshStandardMaterial({ map: noiseTex(hex, kind), roughness: rough, metalness: metal, flatShading: true, ...extra });
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
    const win = new THREE.DirectionalLight('#cddcff', 2.1);
    win.position.set(-7, 9, 0);
    win.target.position.set(0, 0, MID_Z);
    win.castShadow = true;
    win.shadow.mapSize.set(1024, 1024);
    Object.assign(win.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 25 });
    win.shadow.bias = -0.0015;
    win.shadow.normalBias = 0.02;
    const key = new THREE.DirectionalLight('#ffcf95', 1.9);
    key.position.set(6, 4, 4);
    key.target.position.set(0, 1, MID_Z);
    lights.push(win, key);
    g.add(win.target, key.target);

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
    const tile = pix(2, 2, (ctx) => {
      ctx.fillStyle = '#c3c6cc';
      ctx.fillRect(0, 0, 2, 2);
      ctx.fillStyle = '#5f6570';
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillRect(1, 1, 1, 1);
    }, [8, 15]);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 30),
      new THREE.MeshStandardMaterial({ map: tile, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.74 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -5);
    floor.receiveShadow = true;
    g.add(floor);

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
      halo.position.set(0, 2.15, 0);
      halo.layers.enable(REFLECT);
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

  // ---------- voxel knights ----------

  _tabardTex(look, w = 22, h = 28, charge = true) {
    return pix(w, h, (ctx) => {
      const base = rgb(look.tabard);
      const rr = rng(look.tabard.length * 7 + base[1] + w);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          ctx.fillStyle = css(base, 0.88 + rr() * 0.16);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.fillStyle = look.trim;
      ctx.fillRect(0, h - 2, w, 2);
      ctx.fillRect(0, 0, 1, h);
      ctx.fillRect(w - 1, 0, 1, h);
      if (charge && look.charge) drawCharge(ctx, look.charge, w / 2, h * 0.42, w * 0.82, look.chargeColor || PALETTE.goldCss, null);
    });
  }

  _weapon(kind, M) {
    const g = new THREE.Group();
    if (kind === 'axe' || kind === 'greataxe') {
      const big = kind === 'greataxe';
      const len = big ? 1.25 : 0.68;
      this.box(big ? 0.055 : 0.045, len, big ? 0.055 : 0.045, M.wood, 0, -len / 2 + 0.05, 0, g);
      this.box(big ? 0.07 : 0.06, 0.05, big ? 0.07 : 0.06, M.plate, 0, 0.06, 0, g);
      const hy = -len + (big ? 0.16 : 0.11);
      this.box(big ? 0.1 : 0.07, big ? 0.16 : 0.1, 0.05, M.plate, 0.02, hy, 0, g);
      this.box(big ? 0.22 : 0.12, big ? 0.26 : 0.16, 0.032, M.steel, big ? 0.17 : 0.11, hy, 0, g);
      this.box(0.045, big ? 0.42 : 0.25, 0.034, M.edge, big ? 0.3 : 0.19, hy, 0, g);
      if (big) this.box(0.14, 0.06, 0.03, M.steel, -0.1, hy, 0, g);
      return { g, len: len - 0.05 };
    }
    const fal = kind === 'falchion';
    const blade = fal ? 0.6 : 0.78;
    this.box(0.06, 0.06, 0.06, M.gold, 0, 0.09, 0, g);
    this.box(0.042, 0.15, 0.042, M.leather, 0, 0, 0, g);
    this.box(0.3, 0.045, 0.065, M.gold, 0, -0.09, 0, g);
    [-1, 1].forEach((s) => this.box(0.05, 0.07, 0.07, M.gold, s * 0.15, -0.09, 0, g));
    this.box(fal ? 0.08 : 0.06, blade, 0.02, M.steel, fal ? 0.01 : 0, -0.11 - blade / 2, 0, g);
    this.box(0.018, blade * 0.8, 0.022, M.dark, 0, -0.11 - blade * 0.42, 0, g, false);   // fuller
    const tip = this.box(0.043, 0.043, 0.02, M.steel, 0, -0.11 - blade, 0, g);
    tip.rotation.z = Math.PI / 4;
    return { g, len: 0.11 + blade + 0.03 };
  }

  _offhand(kind, look, M) {
    const g = new THREE.Group();
    if (!kind) return g;
    if (kind === 'holly') {
      this.box(0.03, 0.55, 0.03, M.wood, 0, -0.2, 0, g);
      for (let i = 0; i < 7; i++) this.box(0.1, 0.05, 0.03, M.leaf, (i % 2 ? 1 : -1) * 0.05, -0.04 - i * 0.07, 0.01, g);
      return g;
    }
    const field = look.shield || look.tabard;
    const charge = look.shieldCharge ?? look.charge;
    const face = pix(20, 24, (ctx, w, h) => {
      const base = rgb(field);
      const rr = rng(base[0] + 3);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { ctx.fillStyle = css(base, 0.88 + rr() * 0.16 - y * 0.008); ctx.fillRect(x, y, 1, 1); }
      ctx.fillStyle = PALETTE.goldCss;
      ctx.fillRect(0, 0, w, 1);
      ctx.fillRect(0, 0, 1, h);
      ctx.fillRect(w - 1, 0, 1, h);
      if (charge) drawCharge(ctx, charge, w / 2, h * 0.45, w * 0.82, look.chargeColor || PALETTE.goldCss, null);
    });
    const faceMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.6, flatShading: true });
    M.extra.push(faceMat);
    const w = kind === 'buckler' ? 0.3 : kind === 'round' ? 0.52 : 0.44;
    const h = kind === 'buckler' ? 0.3 : kind === 'round' ? 0.52 : 0.5;
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), [M.wood, M.wood, M.wood, M.wood, faceMat, M.wood]);
    board.castShadow = true;
    g.add(board);
    // gold rim and boss
    this.box(w + 0.03, 0.03, 0.06, M.gold, 0, h / 2, 0, g);
    [-1, 1].forEach((s) => this.box(0.03, h, 0.06, M.gold, s * (w / 2 + 0.005), 0, 0, g));
    if (kind === 'heater') {
      [[0.82, 0.08], [0.56, 0.07], [0.3, 0.06], [0.1, 0.05]].forEach(([bw, bh], i) => {
        const y = -h / 2 - 0.035 - i * 0.065;
        this.box(w * bw, bh, 0.05, faceMat, 0, y, 0, g);
        this.box(0.03, bh, 0.06, M.gold, (w * bw) / 2, y, 0, g);
        this.box(0.03, bh, 0.06, M.gold, -(w * bw) / 2, y, 0, g);
      });
    } else {
      this.box(w + 0.03, 0.03, 0.06, M.gold, 0, -h / 2, 0, g);
      this.box(0.1, 0.1, 0.05, M.gold, 0, 0, 0.04, g);
    }
    return g;
  }

  _helm(look, head, M) {
    const helm = M.helm;
    const dark = M.dark;
    const face = () => {
      this.box(0.2, 0.22, 0.2, M.skin, 0, 0, 0, head);
      [-1, 1].forEach((s) => this.box(0.035, 0.028, 0.01, dark, s * 0.048, 0.025, 0.102, head, false));
      this.box(0.05, 0.02, 0.01, M.skinDark, 0, -0.045, 0.102, head, false);
    };
    switch (look.helm) {
      case 'coif':
        // Mail coif under a blue arming cap with a gold band.
        this.box(0.19, 0.2, 0.02, M.skin, 0, -0.01, 0.12, head);
        [-1, 1].forEach((s) => this.box(0.035, 0.028, 0.01, dark, s * 0.048, 0.02, 0.131, head, false));
        this.box(0.26, 0.28, 0.25, M.mail, 0, -0.01, -0.005, head);
        this.box(0.28, 0.1, 0.28, helm, 0, 0.15, 0, head);
        this.box(0.285, 0.03, 0.285, M.gold, 0, 0.105, 0, head);
        this.box(0.32, 0.12, 0.3, M.mail, 0, -0.17, -0.01, head);   // mail falling to the shoulders
        break;
      case 'nasal':
        face();
        this.box(0.235, 0.11, 0.235, helm, 0, 0.1, 0, head);
        this.box(0.17, 0.06, 0.17, helm, 0, 0.18, 0, head);
        this.box(0.04, 0.13, 0.03, helm, 0, 0.0, 0.113, head);
        this.box(0.24, 0.03, 0.24, M.gold, 0, 0.055, 0, head);
        break;
      case 'hood':
        face();
        this.box(0.28, 0.05, 0.28, helm, 0, 0.13, 0, head);
        this.box(0.28, 0.3, 0.05, helm, 0, 0.0, -0.12, head);
        [-1, 1].forEach((s) => this.box(0.04, 0.3, 0.28, helm, s * 0.12, 0.0, 0, head));
        this.box(0.36, 0.1, 0.32, helm, 0, -0.16, 0, head);
        this.box(0.1, 0.16, 0.06, helm, 0, 0.06, -0.16, head);   // liripipe stub
        break;
      case 'antler': {
        this.box(0.28, 0.34, 0.28, helm, 0, 0.03, 0, head);
        this.box(0.25, 0.04, 0.25, helm, 0, 0.21, 0, head);
        this.box(0.22, 0.03, 0.01, dark, 0, 0.06, 0.141, head, false);
        this.box(0.03, 0.14, 0.01, dark, 0, -0.04, 0.141, head, false);
        [[-0.06, -0.08], [0.06, -0.08], [-0.06, -0.12], [0.06, -0.12]].forEach(([x, y]) => this.box(0.02, 0.02, 0.01, dark, x, y, 0.141, head, false));
        [-1, 1].forEach((s) => this._antler(head, s, M));
        break;
      }
      case 'greathelm':
      default:
        this.box(0.27, 0.31, 0.27, helm, 0, 0.02, 0, head);
        this.box(0.24, 0.035, 0.24, helm, 0, 0.19, 0, head);
        this.box(0.22, 0.028, 0.01, dark, 0, 0.055, 0.136, head, false);
        this.box(0.035, 0.24, 0.012, M.trim, 0, 0.0, 0.137, head, false);
        [[-0.07, -0.05], [0.07, -0.05], [-0.07, -0.09], [0.07, -0.09]].forEach(([x, y]) => this.box(0.02, 0.02, 0.01, dark, x, y, 0.136, head, false));
        if (look.crest) {
          this.box(0.05, 0.18, 0.28, M.crest, 0, 0.29, -0.01, head);
          this.box(0.08, 0.05, 0.1, M.crest, 0, 0.36, 0.08, head);
        }
        break;
    }
    if (look.beard && (look.helm === 'nasal' || look.helm === 'hood')) {
      this.box(0.2, 0.12, 0.08, M.beard, 0, -0.13, 0.07, head);
      this.box(0.12, 0.08, 0.06, M.beard, 0, -0.21, 0.08, head);
    }
  }

  // A great branching antler built from short beams.
  _antler(head, s, M) {
    const a = new THREE.Group();
    a.position.set(s * 0.13, 0.17, 0);
    head.add(a);
    const seg = (p, ang, len, z = 0) => {
      const ex = p[0] + Math.sin(ang) * len * s;
      const ey = p[1] + Math.cos(ang) * len;
      const m = this.box(0.055, len + 0.03, 0.055, M.antler, (p[0] + ex) / 2, (p[1] + ey) / 2, z, a);
      m.rotation.z = -s * ang;
      return [ex, ey];
    };
    const e1 = seg([0, 0], 0.95, 0.24);
    const e2 = seg(e1, 0.35, 0.3);
    const e3 = seg(e2, 0.7, 0.28);
    const e4 = seg(e3, 1.15, 0.2);
    seg(e1, -0.15, 0.2, 0.04);
    seg(e2, -0.05, 0.24);
    seg(e3, 0.15, 0.2);
    seg(e2, 1.25, 0.16);
    seg(e4, 0.4, 0.14);
  }

  // Builds a knight facing +z. Returns the parts the animator moves.
  _knight(look, weaponKind, offhandKind, size = 1) {
    const extra = [];
    const M = {
      mail: this.std(look.mail || '#8e949c', 'mail'),
      plate: this.std(look.plate || look.metal || '#a9b0ba', 'plate'),
      helm: this.std(look.helmColor || look.plate || look.metal || '#a9b0ba', look.helm === 'coif' ? 'cloth' : 'plate'),
      skin: this.std(look.skin || '#e2b48a'),
      skinDark: this.std('#8a5a40'),
      beard: this.std(look.beard || '#5a3a20'),
      dark: new THREE.MeshBasicMaterial({ color: '#0d0a08' }),
      trim: this.std(look.trim || PALETTE.goldCss, 'gold'),
      crest: this.std(look.crest || PALETTE.goldCss),
      gold: this.std(PALETTE.goldCss, 'gold'),
      leather: this.std('#4a2f1a', 'wood'),
      wood: this.std('#6b4423', 'wood'),
      boot: this.std('#35241a', 'wood'),
      belt: this.std('#3b2716'),
      steel: this.std(look.blade || '#c9ced6', 'plate'),
      edge: this.std('#e8ecf2', 'plate'),
      leaf: this.std('#3f7a35', 'leaf'),
      antler: this.std(look.antler || '#d8cbb0', 'wood'),
      tabard: this.std(look.tabard),
      extra,
    };
    const front = new THREE.MeshStandardMaterial({ map: this._tabardTex(look), roughness: 0.88, flatShading: true });
    const skirtTex = new THREE.MeshStandardMaterial({ map: this._tabardTex(look, 12, 22, false), roughness: 0.88, flatShading: true });
    extra.push(front, skirtTex);

    const root = new THREE.Group();
    const fig = new THREE.Group();
    fig.scale.setScalar(size);
    root.add(fig);

    // Legs: mail thighs, plate greaves and knee cops, booted feet.
    const legs = [-1, 1].map((s) => {
      const hip = new THREE.Group();
      hip.position.set(s * 0.13, HIP, 0);
      fig.add(hip);
      this.box(0.18, 0.42, 0.2, M.mail, 0, -0.21, 0, hip);
      const knee = new THREE.Group();
      knee.position.y = -THIGH;
      hip.add(knee);
      this.box(0.17, 0.1, 0.08, M.plate, 0, 0.0, 0.09, knee);
      this.box(0.155, 0.36, 0.17, M.plate, 0, -0.2, 0, knee);
      this.box(0.18, 0.13, 0.23, M.boot, 0, -0.43, 0.01, knee);
      this.box(0.16, 0.08, 0.12, M.plate, 0, -0.455, 0.15, knee);
      return { hip, knee, s };
    });

    const body = new THREE.Group();
    body.position.y = HIP;
    fig.add(body);
    this.box(0.46, 0.24, 0.28, M.mail, 0, -0.04, 0, body);
    this.box(0.48, 0.5, 0.29, M.mail, 0, 0.34, 0, body);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.31), [M.tabard, M.tabard, M.tabard, M.tabard, front, front]);
    chest.position.set(0, 0.29, 0);
    chest.castShadow = true;
    body.add(chest);
    this.box(0.5, 0.075, 0.33, M.belt, 0, 0.04, 0, body);
    this.box(0.08, 0.08, 0.02, M.gold, 0, 0.04, 0.17, body);
    this.box(0.09, 0.11, 0.06, M.leather, 0.21, -0.03, 0.12, body);
    // Split tabard skirt that flares over the legs.
    const flap = (w, h, x, z, rx, rz, d = 0.03) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skirtTex);
      m.position.set(x, -0.25, z);
      m.rotation.set(rx, 0, rz);
      m.castShadow = true;
      body.add(m);
      return m;
    };
    const skirt = [
      flap(0.23, 0.46, -0.12, 0.165, -0.12, 0.05),
      flap(0.23, 0.46, 0.12, 0.165, -0.12, -0.05),
      flap(0.46, 0.48, 0, -0.165, 0.12, 0),
      flap(0.03, 0.44, -0.245, 0, 0, 0.1, 0.28),
      flap(0.03, 0.44, 0.245, 0, 0, -0.1, 0.28),
    ];
    this.box(0.28, 0.11, 0.28, M.mail, 0, 0.62, 0, body);
    [-1, 1].forEach((s) => {
      const p1 = this.box(0.24, 0.09, 0.29, M.plate, s * 0.3, 0.61, 0, body);
      p1.rotation.z = -s * 0.35;
      const p2 = this.box(0.21, 0.08, 0.26, M.plate, s * 0.35, 0.53, 0, body);
      p2.rotation.z = -s * 0.55;
      const p3 = this.box(0.04, 0.04, 0.3, M.gold, s * 0.38, 0.575, 0, body);
      p3.rotation.z = -s * 0.4;
    });
    const head = new THREE.Group();
    head.position.y = 0.81;
    body.add(head);
    this._helm(look, head, M);

    const arm = (x) => {
      const sh = new THREE.Group();
      sh.position.set(x, 0.55, 0);
      sh.rotation.order = 'XYZ';
      body.add(sh);
      this.box(0.14, 0.31, 0.15, M.mail, 0, -0.15, 0, sh);
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      sh.add(elbow);
      this.box(0.15, 0.08, 0.08, M.plate, 0, 0, -0.06, elbow);
      this.box(0.13, 0.24, 0.14, M.plate, 0, -0.13, 0, elbow);
      this.box(0.17, 0.06, 0.18, M.plate, 0, -0.27, 0, elbow);
      this.box(0.13, 0.1, 0.14, M.leather, 0, -0.33, 0, elbow);
      return { sh, elbow };
    };
    const R = arm(-0.32);
    const L = arm(0.32);
    const w = this._weapon(weaponKind, M);
    const weapon = new THREE.Group();
    weapon.position.y = -0.35;
    weapon.add(w.g);
    R.elbow.add(weapon);
    const off = this._offhand(offhandKind, look, M);
    off.position.set(0, -0.33, offhandKind === 'holly' ? 0.04 : 0.1);
    L.elbow.add(off);

    // Cape with folds, or the Green Knight's cloak of leaves.
    let cape = null;
    if (look.leafy) {
      cape = this._leafCloak(body, M);
    } else if (look.cape) {
      cape = new THREE.Group();
      cape.position.set(0, 0.63, -0.18);
      body.add(cape);
      const capeTex = pix(22, 44, (ctx, cw, ch) => {
        const base = rgb(look.cape);
        const rr = rng(base[2] + 5);
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            const fold = Math.sin(x * 0.9) * 0.06;
            ctx.fillStyle = css(base, 0.84 + rr() * 0.12 + fold - (y / ch) * 0.14);
            ctx.fillRect(x, y, 1, 1);
          }
        }
        ctx.fillStyle = PALETTE.goldCss;
        ctx.fillRect(0, ch - 2, cw, 2);
        ctx.fillRect(0, 0, cw, 1);
        if (look.capeCharge) drawCharge(ctx, look.capeCharge, cw / 2, 15, cw * 0.86, PALETTE.goldCss, null);
      });
      const capeMat = new THREE.MeshStandardMaterial({ map: capeTex, roughness: 0.9, flatShading: true });
      extra.push(capeMat);
      const cm = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.3, 0.035), [M.tabard, M.tabard, M.tabard, M.tabard, M.tabard, capeMat]);
      cm.position.y = -0.65;
      cm.castShadow = true;
      cape.add(cm);
      [-1, 1].forEach((s) => {
        const fold = this.box(0.1, 1.24, 0.04, M.tabard, s * 0.31, -0.62, 0.05, cape);
        fold.rotation.y = s * 0.5;
      });
      this.box(0.56, 0.08, 0.07, M.tabard, 0, -0.01, 0.01, cape);
      [-1, 1].forEach((s) => this.box(0.07, 0.07, 0.04, M.gold, s * 0.2, 0.0, 0.06, cape));
    }

    const mats = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.layers.enable(REFLECT);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        if (m.emissive && !mats.includes(m)) mats.push(m);
      });
    });
    return { root, fig, body, head, armR: R.sh, elbowR: R.elbow, armL: L.sh, elbowL: L.elbow, weapon, off, legs, cape, skirt, len: w.len, mats, weaponMats: [M.steel, M.edge] };
  }

  // The Green Knight's floor-length cloak of leaves, as instanced leaf blocks.
  _leafCloak(body, M) {
    const cape = new THREE.Group();
    cape.position.set(0, 0.63, -0.16);
    body.add(cape);
    for (let i = -2; i <= 2; i++) {
      const strip = this.box(0.2, 1.45, 0.04, M.leaf, i * 0.15, -0.72, -Math.abs(i) * 0.02, cape);
      strip.rotation.z = i * 0.09;
      strip.rotation.x = 0.05;
    }
    const rr = rng(4242);
    const onBody = [];
    const onCape = [];
    for (let i = 0; i < 46; i++) {
      const s = rr() > 0.5 ? 1 : -1;
      onBody.push({ p: [s * (0.18 + rr() * 0.22), 0.46 + rr() * 0.22, -0.12 + rr() * 0.3], size: 0.08 + rr() * 0.07 });
    }
    for (let i = 0; i < 18; i++) onBody.push({ p: [-0.22 + rr() * 0.44, 0.15 + rr() * 0.4, 0.17], size: 0.07 + rr() * 0.05 });
    for (let i = 0; i < 40; i++) onCape.push({ p: [-0.42 + rr() * 0.84, -0.2 - rr() * 1.3, -0.04 - rr() * 0.04], size: 0.08 + rr() * 0.07 });
    for (let i = 0; i < 16; i++) onCape.push({ p: [-0.45 + i * 0.06, -1.45 - rr() * 0.12, -0.03], size: 0.07 + rr() * 0.04 });
    const greens = ['#2f6b2a', '#3f8a35', '#557a2a', '#2a5226', '#6a9a3a', '#4a6a24'].map((c) => new THREE.Color(c));
    const geo = new THREE.BoxGeometry(1, 1, 0.4);
    const mat = this.std('#ffffff', 'leaf');
    const make = (list, parent) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      list.forEach((l, i) => {
        q.setFromEuler(e.set(rr() * 0.8, rr() * 1.2, rr() * 3));
        m.compose(new THREE.Vector3(...l.p), q, new THREE.Vector3(l.size, l.size * 1.3, l.size));
        im.setMatrixAt(i, m);
        im.setColorAt(i, greens[Math.floor(rr() * greens.length)]);
      });
      im.castShadow = true;
      parent.add(im);
    };
    make(onBody, body);
    make(onCape, cape);
    return cape;
  }

  _lookFor(def) {
    if (def.look) return def.look;
    const p = def.palette;
    return { tabard: p.body, trim: p.trim, helm: 'greathelm', helmColor: p.helmColor || '#888', mail: p.sleeve, plate: p.legs, skin: p.skin };
  }

  // ---------- rigs handed to the combat code ----------

  buildEnemy(def) {
    const look = { ...this._lookFor(def), blade: def.palette.blade };
    const f = this._knight(look, def.weapon, def.offhand, (def.size || 1) * 1.04);
    f.root.position.set(0, 0, ENEMY_Z);
    f.root.rotation.y = ENEMY_TURN;
    this.content.add(f.root);
    const prox = { root: new P(), body: new P(), head: new P(), armL: new P(), armR: new P(), weapon: new P() };
    this.enemy = { ...f, prox, faded: false, reach: 0, elbow: 0.4, lastZ: ENEMY_Z, walk: 0, hp: null, stance: 0.55, crouch: 0.05, lean: 0 };
    const view = this;
    prox.root.flash = (ms) => {
      f.mats.forEach((m) => m.emissive.setRGB(0.9, 0.9, 0.85));
      setTimeout(() => f.mats.forEach((m) => m.emissive.setRGB(0, 0, 0)), ms + 15);
    };
    return {
      ...prox,
      weaponLen: f.len / K,
      setWeaponTint(c) {
        f.weaponMats.forEach((m) => (c === null ? m.emissive.setRGB(0, 0, 0) : m.emissive.setRGB(0.9, 0.08, 0.03)));
      },
      tip(frac = 1) { return view.project(f.weapon.localToWorld(view.v.set(0, -f.len * frac, 0))); },
      headPoint() { return view.project(f.head.localToWorld(view.v.set(0, 0.3, 0))); },
      chestPoint() { return view.project(f.body.localToWorld(view.v.set(0, 0.35, 0.2))); },
    };
  }

  buildPlayer(sword, shield) {
    const look = { ...PLAYER_LOOK, blade: sword.color, shield: shield.field, shieldCharge: 'lion' };
    const kind = shield.id === 'targe' ? 'round' : 'heater';
    const f = this._knight(look, 'sword', kind, 1);
    f.root.position.set(0, 0, PLAYER_Z);
    f.root.rotation.y = Math.PI;
    this.content.add(f.root);
    this.player = { body3d: true, f, hp: null, flashUntil: 0, pose: { ...GUARD }, stance: 1, crouch: 0.42 };
    const W = VIEW.W;
    const H = VIEW.H;
    const swordHome = { x: W / 2 + W * 0.3, y: H + 20, angle: 8 };
    const shieldHome = { x: W / 2 - W * 0.31, y: H + 40, angle: 6 };
    const view = this;
    return {
      swordArm: new P(swordHome.x, swordHome.y), shield: new P(shieldHome.x, shieldHome.y), swordHome, shieldHome, side: 1,
      chestPoint() { return view.project(f.body.localToWorld(view.v.set(0, 0.5, 0))); },
    };
  }

  // ---------- animation ----------

  // Fighting stance with the figure's left foot leading; keeps the feet on the floor.
  _legs(f, stance, crouch, walk, spread = 1) {
    const t = this.time;
    let reach = 0;
    f.legs.forEach(({ hip, knee, s }) => {
      const lead = s > 0;
      const swing = walk * Math.sin(t * 0.011 + (lead ? 0 : Math.PI)) * 0.55;
      const hx = lead ? -(0.22 + 0.42 * stance) - crouch * 0.35 + swing : 0.12 + 0.34 * stance - crouch * 0.1 + swing;
      const kx = lead ? 0.15 + 0.55 * stance + crouch * 0.75 + Math.max(0, -swing) : 0.08 + 0.2 * stance + crouch * 0.35 + Math.max(0, swing) * 0.6;
      const hz = s * (0.06 + 0.13 * spread * stance);
      hip.rotation.set(hx, 0, hz);
      knee.rotation.x = kx;
      const v = (THIGH * Math.cos(hx) + SHIN * Math.cos(hx + kx)) * Math.cos(hz);
      reach = Math.max(reach, v);
    });
    f.fig.position.y = (reach - (THIGH + SHIN)) * f.fig.scale.y;
    // Let the skirt flaps swing a little with the legs.
    if (f.skirt) {
      f.skirt[0].rotation.x = -0.12 + Math.min(0, f.legs[0].hip.rotation.x) * 0.5;
      f.skirt[1].rotation.x = -0.12 + Math.min(0, f.legs[1].hip.rotation.x) * 0.5;
      f.skirt[2].rotation.x = 0.12 + Math.max(0, f.legs[0].hip.rotation.x, f.legs[1].hip.rotation.x) * 0.5;
    }
  }

  _syncEnemy(e, dt) {
    const v = this.enemy;
    if (!v) return;
    const r = v.prox;
    const fwd = r.root.scaleX / e.size - 1;
    const z = ENEMY_Z + fwd * 5;
    v.root.position.set((r.root.x - e.baseX) * K, -(r.root.y - e.baseY) * K, z);
    const speed = dt > 0 ? Math.abs(z - v.lastZ) / dt : 0;
    v.lastZ = z;
    v.walk += ((speed > 0.0004 ? 1 : 0) - v.walk) * Math.min(1, dt / 120);
    v.root.rotation.z = -r.root.angle * DEG;
    v.body.position.set(r.body.x * K, HIP - r.body.y * K * 0.6, 0);
    v.body.rotation.z = -r.body.angle * DEG;
    v.head.rotation.z = -r.head.angle * DEG;
    v.weapon.rotation.z = -r.weapon.angle * DEG;

    // Imposing A-frame stance; sinks and lunges with the attack.
    let reach = 0;
    let elbow = 0.4;
    let crouch = 0.05;
    let stance = 0.55;
    let lean = 0.04;
    if (e.state === ES.TELEGRAPH) { reach = -0.5 * Math.min(1, e.t / 260); elbow = 0.25; crouch = 0.25; stance = 0.8; lean = -0.06; }
    else if (e.state === ES.STRIKE) { reach = -0.85; elbow = 0; crouch = 0.4; stance = 1; lean = 0.22; }
    else if (e.state === ES.PARRIED) { reach = 0.35; elbow = 0.6; crouch = 0.2; lean = -0.15; }
    else if (e.state === ES.STAGGERED) { elbow = 0.2; crouch = 0.55; stance = 0.4; lean = 0.25; }
    else if (e.state === ES.RECOVER) { elbow = 0.3; crouch = 0.3; stance = 0.7; lean = 0.12; }
    const k = Math.min(1, dt / (e.state === ES.STRIKE ? 40 : 120));
    v.reach += (reach - v.reach) * k;
    v.elbow += (elbow - v.elbow) * k;
    v.crouch += (crouch - v.crouch) * k;
    v.stance += (stance - v.stance) * k;
    v.lean += (lean - v.lean) * k;
    v.body.rotation.x = v.lean;
    v.armR.rotation.z = -r.armR.angle * DEG;
    v.armR.rotation.x = v.reach;
    v.elbowR.rotation.x = -v.elbow;
    // Off arm held out from the body.
    v.armL.rotation.set(-0.3, 0, -(r.armL.angle - 10) * DEG);
    v.elbowL.rotation.x = -0.75;
    if (v.off) v.off.rotation.x = 1.05;
    this._legs(v, e.state === ES.DEFEATED ? 0.2 : v.stance, v.crouch, v.walk, 1.4);
    if (v.cape) v.cape.rotation.x = 0.05 - v.lean + v.walk * 0.22 + Math.sin(this.time * 0.003) * 0.02;

    if (v.hp !== null && e.health < v.hp) this.cheer = 1;
    v.hp = e.health;

    const a = r.root.alpha;
    if (a < 0.999 || v.faded) {
      v.faded = a < 0.999;
      v.root.traverse((o) => {
        if (!o.isMesh) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          m.transparent = a < 0.999;
          m.opacity = a;
        });
      });
    }
  }

  _syncPlayerBody(pl, dt) {
    const v = this.player;
    if (!v || !pl) return;
    const f = v.f;
    const now = performance.now();
    const T = { ...GUARD };
    let stance = 1;
    let crouch = 0.42;
    let walk = 0;
    let speed = 110;
    switch (pl.state) {
      case PS.DODGING: {
        const s = Math.sin(Math.PI * Math.min(1, pl.stateT / CONFIG.dodge.durationMs));
        const dir = pl.dodgeSide === 'left' ? -1 : 1;
        T.rootX = dir * 0.9 * s;
        T.bodyA = -dir * 12 * s;
        crouch = 0.42 + 0.35 * s;
        walk = s * 0.6;
        speed = 1;
        break;
      }
      case PS.BLOCKING:
        Object.assign(T, { armLx: -1.25, armL: 34, elbowL: 0.95, bodyRx: 0.24, armRx: -0.6, armR: 18, elbowR: 0.5, wrist: -0.2, twist: -0.25 });
        crouch = 0.6;
        speed = 45;
        break;
      case PS.STUNNED:
        Object.assign(T, { bodyRx: -0.25, armR: 40, armRx: -0.2, wrist: 0.3, armL: 15, armLx: -0.3, elbowR: 0.2 });
        crouch = 0.2;
        speed = 40;
        break;
      case PS.DEAD:
        Object.assign(T, { bodyRx: -1.45, bodyY: -0.3, armR: 110, armRx: 0, armL: -110, armLx: 0, wrist: 0, elbowR: 0, elbowL: 0 });
        stance = 0.2;
        crouch = 0.9;
        speed = 260;
        break;
      default:
        break;
    }
    const sp = (now - (pl.swingAt || -1e9)) / 280;
    if (sp >= 0 && sp < 1 && pl.state !== PS.DEAD && pl.state !== PS.STUNNED && pl.swingDir) {
      const [dx0, dy] = DIR_VEC[pl.swingDir];
      const dx = -dx0;   // seen from behind, screen-right is his right
      if (sp < 0.22) {
        const COCKED = { S: [135, 135], SW: [125, 110], SE: [-160, 70] };
        const c = COCKED[pl.swingDir];
        Object.assign(T, {
          armR: c ? c[0] : angFor(-dx, -dy - 0.4 * (1 - Math.abs(dy))), weapon: c ? c[1] : -dx * 25,
          armRx: 0.2, elbowR: 0.5, wrist: 0, twist: 0.35, bodyA: -dx * 6, bodyRx: 0.1,
        });
      } else if (sp < 0.7) {
        Object.assign(T, { armR: angFor(dx, dy + 0.35), weapon: 0, armRx: -1.0, elbowR: 0, wrist: 0, twist: -0.45, bodyA: dx * 8, bodyRx: 0.3 });
        crouch = 0.6;
      }
      speed = 18;
    }
    const k = speed <= 1 ? 1 : Math.min(1, dt / speed);
    const P0 = v.pose;
    for (const key of Object.keys(T)) P0[key] += (T[key] - P0[key]) * k;
    v.stance += (stance - v.stance) * Math.min(1, dt / 120);
    v.crouch += (crouch - v.crouch) * (speed <= 1 ? 1 : k);

    f.root.position.x = P0.rootX;
    f.body.position.y = HIP + P0.bodyY + Math.sin(now / 650) * 0.008;
    f.body.rotation.set(P0.bodyRx, P0.twist, -P0.bodyA * DEG);
    f.armR.rotation.set(P0.armRx, 0, -P0.armR * DEG);
    f.elbowR.rotation.x = -P0.elbowR;
    f.weapon.rotation.set(P0.wrist, 0, -P0.weapon * DEG);
    f.armL.rotation.set(P0.armLx, 0, -P0.armL * DEG);
    f.elbowL.rotation.x = -P0.elbowL;
    if (f.off) f.off.rotation.x = -(P0.armLx - P0.elbowL);
    this._legs(f, v.stance, v.crouch, walk, 1);
    // The cape hangs straight down whatever the lean, flaring a little when he moves.
    if (f.cape) f.cape.rotation.x = 0.06 - P0.bodyRx + Math.abs(P0.rootX) * 0.3 + Math.sin(now * 0.003) * 0.025;

    if (v.hp !== null && pl.health < v.hp) v.flashUntil = now + 120;
    v.hp = pl.health;
    const on = now < v.flashUntil;
    if (on !== v.flashing) {
      v.flashing = on;
      f.mats.forEach((m) => (on ? m.emissive.setRGB(0.8, 0.1, 0.05) : m.emissive.setRGB(0, 0, 0)));
    }
  }

  // ---------- per-frame ----------

  render(duel, dt) {
    this.syncCanvas();
    const now = performance.now();
    this.time = now;
    const cam = this.camera;
    const px = this.player ? this.player.f.root.position.x : 0;
    cam.position.copy(this.camHome);
    cam.position.x += px * 0.3;
    cam.position.y += Math.sin(now / 1900) * 0.015;
    const sh = duel.cameras.main.shakeEffect;
    if (sh && sh.isRunning) {
      cam.position.x += (sh._offsetX || 0) * 0.004;
      cam.position.y += (sh._offsetY || 0) * 0.004;
    }
    cam.up.set(0, 1, 0);
    cam.lookAt(this.camTarget.x + px * 0.2, this.camTarget.y, this.camTarget.z);
    cam.updateMatrixWorld();

    if (duel.enemy) {
      this._syncEnemy(duel.enemy, dt);
      const c = duel.enemy.rig.chestPoint();
      duel.enemy.aura.setPosition(c.x - (duel.world ? duel.world.x : 0), c.y - 20);
    }
    this._syncPlayerBody(duel.player, dt);

    (this.candles || []).forEach((c) => {
      c.light.intensity = c.base * (0.88 + Math.sin(now * 0.017 + c.phase) * 0.06 + Math.sin(now * 0.041 + c.phase * 3) * 0.05);
    });
    (this.banners || []).forEach((b) => { b.rotation.z = Math.sin(now * 0.0011 + b.userData.phase) * 0.025; });
    this.cheer = Math.max(0, this.cheer - (dt || 16) / 700);
    this._updateCrowd(now);

    this.renderer.render(this.scene, cam);
  }

  clear() {
    super.clear();
    this.crowd = null;
    this.candles = [];
    this.banners = [];
    this.scene.background = null;
  }
}
