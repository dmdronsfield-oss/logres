import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
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
const ENEMY_Z = -3.4;
const PLAYER_Z = -1.1;
const HIP = 0.92;
const K = 0.0048;                // metres per logical pixel for enemy pose offsets
const FOV = 40;
const MID_Z = (ENEMY_Z + PLAYER_Z) / 2;
// Camera orbits the middle of the duel from behind your knight's sword shoulder.
const ORBIT = { angle: 44, dist: 5.0, height: 1.95, lookY: 1.0, lead: 0.15 };
const ENEMY_TURN = 0.35;   // radians the enemy turns toward the camera so his sword arm reads
const MAX_PIXEL_RATIO = 1.5;

export const PLAYER_LOOK = {
  tabard: PALETTE.lapisCss, trim: PALETTE.goldCss, charge: 'lion', helm: 'kettle', helmColor: '#34477e',
  mail: '#8e949c', metal: '#aab1bc', cape: '#2b4a9b', capeCharge: 'lion', skin: '#e2b48a',
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
        let f = 0.9 + r() * 0.18;
        if (kind === 'mail') f *= (x + (y % 2)) % 2 ? 0.72 : 1.08;
        if (kind === 'metal') f *= 1.12 - (y / h) * 0.28 + (r() > 0.93 ? 0.25 : 0);
        if (kind === 'wood') f *= y % 4 === 0 ? 0.78 : 1;
        if (kind === 'leaf') f *= r() > 0.6 ? 1.25 : r() > 0.5 ? 0.7 : 1;
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
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
    const rough = { metal: 0.42, mail: 0.55, stone: 0.92, wood: 0.8, leaf: 0.9 }[kind] ?? 0.86;
    const metal = { metal: 0.45, mail: 0.3 }[kind] ?? 0;
    return new THREE.MeshStandardMaterial({ map: noiseTex(hex, kind), roughness: rough, metalness: metal, flatShading: true, ...extra });
  }

  // ---------- the great hall ----------

  buildEnv() {
    const g = new THREE.Group();
    this.content.add(g);
    const r = rng(1066);
    const bg = new THREE.Color('#1b2130');
    this.scene.background = bg;
    this.scene.fog = new THREE.FogExp2('#2a3142', 0.022);

    // Lights: cool window light (with shadows), warm candles, dim sky fill.
    g.add(new THREE.HemisphereLight('#a9bbdd', '#5a4030', 1.7));
    const win = new THREE.DirectionalLight('#d7e4ff', 2.4);
    win.position.set(-6, 9, 1);
    win.target.position.set(0, 0, (ENEMY_Z + PLAYER_Z) / 2);
    win.castShadow = true;
    win.shadow.mapSize.set(1024, 1024);
    Object.assign(win.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 25 });
    win.shadow.bias = -0.0015;
    win.shadow.normalBias = 0.02;
    g.add(win, win.target);
    // Warm key light from the camera's side so the fighters' faces read.
    const key = new THREE.DirectionalLight('#ffd9a8', 1.6);
    key.position.set(6, 4, 4);
    key.target.position.set(0, 1, (ENEMY_Z + PLAYER_Z) / 2);
    g.add(key, key.target);

    const stone = this.std('#7d7f88', 'stone');
    const stoneDark = this.std('#5e6069', 'stone');
    const wood = this.std('#4a2f1e', 'wood');

    // Floor: glossy pale marble checks that catch the candlelight.
    const tile = pix(2, 2, (ctx) => {
      ctx.fillStyle = '#b4b8bf';
      ctx.fillRect(0, 0, 2, 2);
      ctx.fillStyle = '#6a707b';
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillRect(1, 1, 1, 1);
    }, [16, 34]);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 34),
      new THREE.MeshStandardMaterial({ map: tile, roughness: 0.22, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -6);
    floor.receiveShadow = true;
    g.add(floor);

    // Walls, ceiling.
    this.box(0.6, 11, 34, stoneDark, -7.6, 5.5, -6, g, false);
    this.box(0.6, 11, 34, stoneDark, 7.6, 5.5, -6, g, false);
    this.box(16, 11, 0.6, stoneDark, 0, 5.5, -20, g, false);
    this.box(16, 0.4, 34, this.std('#2a2a33', 'wood'), 0, 10.6, -6, g, false);

    // Tall windows on the left wall with soft light shafts.
    const glass = new THREE.MeshBasicMaterial({ color: '#cfe0ff' });
    const shaft = new THREE.MeshBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    [-2.5, -10.5].forEach((z) => {
      this.box(0.1, 4.2, 1.6, glass, -7.25, 5.2, z, g, false);
      this.box(0.12, 0.12, 1.7, stone, -7.2, 5.2, z, g, false);
      this.box(0.12, 4.3, 0.12, stone, -7.2, 5.2, z, g, false);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 9), shaft);
      s.position.set(-4.4, 3.4, z);
      s.rotation.set(0, Math.PI / 2, 0.62);
      g.add(s);
    });

    // Pillars and arches.
    const pillarZ = [3, -1.2, -5.4, -9.6, -13.8];
    for (const sx of [-1, 1]) {
      for (const z of pillarZ) {
        const x = sx * 5.1;
        if (sx > 0 && z > -2) continue;   // keep the camera's side clear
        this.box(0.9, 8.6, 0.9, stone, x, 4.3, z, g);
        this.box(1.25, 0.4, 1.25, stoneDark, x, 0.2, z, g);
        this.box(1.25, 0.35, 1.25, stoneDark, x, 8.7, z, g);
      }
      this.box(0.9, 0.7, 20, stoneDark, sx * 5.1, 9.2, -5.4, g, false);
    }

    // Banners: blue lions and green stags hanging from the pillars.
    const banner = (field, charge) => pix(24, 64, (ctx, w, h) => {
      ctx.fillStyle = field;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = PALETTE.goldCss;
      ctx.fillRect(0, 0, w, 2);
      ctx.fillRect(0, 0, 1, h);
      ctx.fillRect(w - 1, 0, 1, h);
      drawCharge(ctx, charge, w / 2, 24, 18, PALETTE.goldCss, null);
      ctx.clearRect(0, h - 8, w, 8);
      ctx.fillStyle = field;
      for (let x = 0; x < w; x++) {
        const d = Math.abs(x - w / 2);
        ctx.fillRect(x, h - 8, 1, 8 - Math.round((d / (w / 2)) * 8));
      }
    });
    const bannerMats = [
      new THREE.MeshStandardMaterial({ map: banner('#24387a', 'lion'), roughness: 0.9, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ map: banner('#24502a', 'stag'), roughness: 0.9, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    ];
    this.banners = [];
    let bi = 0;
    for (const sx of [-1, 1]) {
      for (const z of pillarZ) {
        if (sx > 0 && z > -2) continue;
        const b = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.9), bannerMats[bi++ % 2]);
        b.position.set(sx * 4.6, 6.0, z);
        b.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        b.userData.phase = r() * 6;
        g.add(b);
        this.banners.push(b);
      }
    }

    // Tapestry of the tree over the high table.
    const tap = pix(48, 44, (ctx, w, h) => {
      ctx.fillStyle = '#1f3b25';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = PALETTE.goldCss;
      ctx.fillRect(0, 0, w, 1);
      ctx.fillRect(0, h - 1, w, 1);
      ctx.fillRect(0, 0, 1, h);
      ctx.fillRect(w - 1, 0, 1, h);
      ctx.fillStyle = '#b98a2c';
      ctx.fillRect(2, 2, w - 4, 1);
      ctx.fillRect(2, h - 3, w - 4, 1);
      // trunk and cross
      ctx.fillStyle = '#c99a3a';
      ctx.fillRect(23, 14, 2, 26);
      ctx.fillRect(18, 22, 12, 2);
      // crown of leaves
      for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * 11;
        ctx.fillStyle = r() > 0.4 ? '#c99a3a' : '#8a6a24';
        ctx.fillRect(Math.round(24 + Math.cos(a) * d * 1.3), Math.round(14 + Math.sin(a) * d * 0.8), 2, 2);
      }
      drawCharge(ctx, 'stag', 9, 30, 14, '#c99a3a', null);
      drawCharge(ctx, 'stag', 39, 30, 14, '#c99a3a', null);
      ctx.fillStyle = '#c99a3a';
      [[8, 8], [40, 8]].forEach(([x, y]) => { ctx.fillRect(x - 1, y - 3, 2, 7); ctx.fillRect(x - 3, y - 1, 7, 2); });
    });
    const tapestry = new THREE.Mesh(new THREE.PlaneGeometry(6, 5.5), new THREE.MeshStandardMaterial({ map: tap, roughness: 0.95 }));
    tapestry.position.set(0, 6.0, -19.65);
    g.add(tapestry);
    this.box(7, 3, 0.1, this.std('#6d1f22'), 0, 1.9, -19.6, g, false);

    // Dais, high table and the royal couple.
    this.box(10, 0.25, 3.2, stoneDark, 0, 0.125, -17.6, g);
    this.box(10, 0.5, 2.0, stoneDark, 0, 0.25, -18.4, g);
    this.box(5.2, 0.85, 0.9, wood, 0, 0.92, -17.4, g);
    this.box(5.3, 0.6, 0.05, this.std('#7a2025'), 0, 0.85, -16.93, g);
    const royal = (x, robe, crownH) => {
      const p = new THREE.Group();
      p.position.set(x, 0.5, -18.0);
      this.box(0.5, 0.75, 0.32, this.std(robe), 0, 0.85, 0, p);
      this.box(0.24, 0.26, 0.24, this.std('#e2b48a'), 0, 1.38, 0, p);
      this.box(0.27, crownH, 0.27, this.std(PALETTE.goldCss, 'metal'), 0, 1.53 + crownH / 2 - 0.04, 0, p);
      this.box(0.9, 1.6, 0.15, wood, 0, 0.8, -0.3, p);   // throne back
      g.add(p);
    };
    royal(-0.6, '#2b3f8a', 0.1);
    royal(0.6, '#7a2a5a', 0.07);

    // Candelabras with warm, flickering point lights.
    this.candles = [];
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffcf6a' });
    const waxMat = this.std('#efe6cf');
    const iron = this.std('#2a2522', 'metal');
    [[-3.4, -5.6], [3.2, -6.4], [-2.6, -15.6], [2.6, -15.6]].forEach(([x, z], i) => {
      const c = new THREE.Group();
      c.position.set(x, 0, z);
      this.box(0.4, 0.08, 0.4, iron, 0, 0.04, 0, c);
      this.box(0.07, 1.9, 0.07, iron, 0, 0.95, 0, c);
      this.box(0.9, 0.05, 0.05, iron, 0, 1.75, 0, c);
      [-0.4, -0.2, 0, 0.2, 0.4].forEach((dx, j) => {
        const hgt = j === 2 ? 2.05 : 1.9;
        this.box(0.06, 0.18, 0.06, waxMat, dx, hgt - 0.07, 0, c, false);
        this.box(0.035, 0.06, 0.035, flameMat, dx, hgt + 0.05, 0, c, false);
      });
      const light = new THREE.PointLight('#ffae55', i < 2 ? 12 : 14, 11, 2);
      light.position.set(0, 2.1, 0);
      c.add(light);
      this.candles.push({ light, base: light.intensity, phase: i * 1.7 });
      g.add(c);
    });

    // Spectators lining the hall, built as instanced blocks.
    this._crowd(g, r);
  }

  _crowd(g, r) {
    const spots = [];
    for (const sx of [-1, 1]) {
      for (let z = 2.5; z > -13; z -= 0.75) {
        if (sx > 0 && z > -2.5) continue;
        for (let row = 0; row < 2; row++) {
          if (r() < 0.25) continue;
          spots.push({ x: sx * (5.9 + row * 0.7 + r() * 0.2), z: z + r() * 0.3, ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2, h: 0.9 + r() * 0.15 });
        }
      }
    }
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) spots.push({ x: sx * (2.2 + i * 0.6), z: -15.2 - (i % 2) * 0.5, ry: 0, h: 0.95 + r() * 0.1 });
    }
    const n = spots.length;
    const mk = (w, h, d, hex) => {
      const m = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), this.std(hex), n);
      m.castShadow = false;
      g.add(m);
      return m;
    };
    const legs = mk(0.3, 0.8, 0.22, '#3a3330');
    const torso = mk(0.44, 0.6, 0.26, '#ffffff');
    const heads = mk(0.22, 0.24, 0.22, '#e2b48a');
    const hair = mk(0.24, 0.08, 0.24, '#ffffff');
    const tunic = ['#2b4a9b', '#7a2a2a', '#3f6a35', '#6a5a3a', '#4a4a6a', '#8a6a2a', '#5a2a5a'].map((c) => new THREE.Color(c));
    const hairC = ['#3b2716', '#c8892e', '#1a1a1a', '#7a5a3a', '#9a9a9a'].map((c) => new THREE.Color(c));
    spots.forEach((s, i) => {
      torso.setColorAt(i, tunic[Math.floor(r() * tunic.length)]);
      hair.setColorAt(i, hairC[Math.floor(r() * hairC.length)]);
      s.phase = r() * 10;
    });
    this.crowd = { spots, legs, torso, heads, hair, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1) };
    this._updateCrowd(0);
  }

  _updateCrowd(t) {
    const c = this.crowd;
    if (!c) return;
    c.spots.forEach((s, i) => {
      const bob = this.cheer * Math.abs(Math.sin(t * 0.012 + s.phase)) * 0.14 + Math.sin(t * 0.002 + s.phase) * 0.008;
      c.q.setFromEuler(c.e.set(0, s.ry, 0));
      const put = (mesh, y) => {
        c.m.compose(c.v.set(s.x, (y + bob) * s.h, s.z), c.q, c.one);
        mesh.setMatrixAt(i, c.m);
      };
      put(c.legs, 0.4);
      put(c.torso, 1.1);
      put(c.heads, 1.53);
      put(c.hair, 1.67);
    });
    ['legs', 'torso', 'heads', 'hair'].forEach((k) => { c[k].instanceMatrix.needsUpdate = true; });
  }

  // ---------- voxel knights ----------

  _tabardTex(look, w = 20, h = 30) {
    return pix(w, h, (ctx) => {
      const base = rgb(look.tabard);
      const rr = rng(look.tabard.length * 7 + base[1]);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          ctx.fillStyle = css(base, 0.9 + rr() * 0.16);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.fillStyle = look.trim;
      ctx.fillRect(0, h - 2, w, 2);
      ctx.fillRect(0, 0, 1, h);
      ctx.fillRect(w - 1, 0, 1, h);
      if (look.charge) drawCharge(ctx, look.charge, w / 2, h * 0.4, w * 0.8, look.chargeColor || PALETTE.goldCss, null);
    });
  }

  _weapon(kind, look, M) {
    const g = new THREE.Group();
    const steel = M.steel;
    if (kind === 'axe' || kind === 'greataxe') {
      const big = kind === 'greataxe';
      const len = big ? 1.2 : 0.66;
      this.box(big ? 0.055 : 0.045, len, big ? 0.055 : 0.045, M.wood, 0, -len / 2 + 0.04, 0, g);
      const hy = -len + (big ? 0.14 : 0.1);
      this.box(big ? 0.3 : 0.17, big ? 0.24 : 0.15, 0.03, steel, big ? 0.17 : 0.1, hy, 0, g);
      this.box(0.04, big ? 0.38 : 0.23, 0.032, M.edge, big ? 0.33 : 0.19, hy, 0, g);
      if (big) this.box(0.12, 0.06, 0.03, steel, -0.08, hy, 0, g);
      return { g, len: len - 0.05 };
    }
    const fal = kind === 'falchion';
    const blade = fal ? 0.58 : 0.74;
    this.box(0.055, 0.055, 0.055, M.gold, 0, 0.08, 0, g);
    this.box(0.04, 0.14, 0.04, M.leather, 0, 0, 0, g);
    this.box(0.27, 0.045, 0.06, M.gold, 0, -0.09, 0, g);
    this.box(fal ? 0.075 : 0.056, blade, 0.018, steel, fal ? 0.01 : 0, -0.11 - blade / 2, 0, g);
    const tip = this.box(0.04, 0.04, 0.018, steel, 0, -0.11 - blade, 0, g);
    tip.rotation.z = Math.PI / 4;
    return { g, len: 0.11 + blade + 0.03 };
  }

  _offhand(kind, look, M) {
    const g = new THREE.Group();
    if (!kind) return g;
    if (kind === 'holly') {
      this.box(0.03, 0.55, 0.03, M.wood, 0, -0.2, 0, g);
      for (let i = 0; i < 6; i++) this.box(0.09, 0.05, 0.03, M.leaf, (i % 2 ? 1 : -1) * 0.05, -0.05 - i * 0.07, 0.01, g);
      return g;
    }
    const field = look.shield || look.tabard;
    const charge = look.shieldCharge ?? look.charge;
    const face = pix(20, 24, (ctx, w, h) => {
      ctx.fillStyle = PALETTE.goldCss;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = field;
      ctx.fillRect(1, 1, w - 2, h - 2);
      if (charge) drawCharge(ctx, charge, w / 2, h * 0.45, w * 0.8, look.chargeColor || PALETTE.goldCss, null);
    });
    const faceMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.7, flatShading: true });
    M.extra.push(faceMat);
    const w = kind === 'buckler' ? 0.3 : kind === 'round' ? 0.5 : 0.42;
    const h = kind === 'buckler' ? 0.3 : kind === 'round' ? 0.5 : 0.52;
    // A chunky board with the painted face, plus a stepped point for heater shields.
    const mats = [M.wood, M.wood, M.wood, M.wood, faceMat, M.wood];
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), mats);
    board.castShadow = true;
    g.add(board);
    if (kind === 'heater') {
      [[0.3, 0.07], [0.18, 0.06], [0.07, 0.05]].forEach(([bw, bh], i) => {
        this.box(w * bw / 0.42 * 1.0, bh, 0.05, M.gold, 0, -h / 2 - 0.03 - i * 0.06, 0, g);
      });
    }
    return g;
  }

  _helm(look, head, M) {
    const helmMat = M.helm;
    const dark = M.dark;
    const face = (eyes = true) => {
      this.box(0.2, 0.22, 0.2, M.skin, 0, 0, 0, head);
      if (eyes) [-1, 1].forEach((s) => this.box(0.035, 0.03, 0.01, dark, s * 0.048, 0.02, 0.102, head, false));
    };
    switch (look.helm) {
      case 'kettle':
        face();
        this.box(0.24, 0.12, 0.24, helmMat, 0, 0.11, 0, head);
        this.box(0.34, 0.035, 0.34, helmMat, 0, 0.05, 0, head);
        this.box(0.24, 0.16, 0.08, M.mail, 0, -0.03, -0.09, head);
        break;
      case 'nasal':
        face();
        this.box(0.23, 0.11, 0.23, helmMat, 0, 0.1, 0, head);
        this.box(0.04, 0.12, 0.03, helmMat, 0, 0.0, 0.112, head);
        break;
      case 'hood':
        face();
        this.box(0.28, 0.05, 0.28, helmMat, 0, 0.13, 0, head);
        this.box(0.28, 0.3, 0.05, helmMat, 0, 0.0, -0.12, head);
        [-1, 1].forEach((s) => this.box(0.04, 0.3, 0.28, helmMat, s * 0.12, 0.0, 0, head));
        this.box(0.34, 0.09, 0.3, helmMat, 0, -0.15, 0, head);
        break;
      case 'antler': {
        this.box(0.26, 0.32, 0.26, helmMat, 0, 0.02, 0, head);
        this.box(0.2, 0.03, 0.01, dark, 0, 0.05, 0.131, head, false);
        this.box(0.03, 0.12, 0.01, dark, 0, -0.04, 0.131, head, false);
        const bone = M.antler;
        [-1, 1].forEach((s) => {
          const a = new THREE.Group();
          a.position.set(s * 0.12, 0.16, 0);
          a.scale.setScalar(1.5);
          head.add(a);
          const seg = (x, y, len, rot) => {
            const m = this.box(0.05, len, 0.05, bone, x, y, 0, a);
            m.rotation.z = rot;
            return m;
          };
          seg(s * 0.06, 0.1, 0.24, -s * 0.6);
          seg(s * 0.17, 0.3, 0.26, -s * 0.15);
          seg(s * 0.25, 0.5, 0.24, -s * 0.45);
          seg(s * 0.08, 0.38, 0.14, s * 0.5);
          seg(s * 0.13, 0.55, 0.14, s * 0.3);
          seg(s * 0.34, 0.33, 0.12, -s * 1.1);
        });
        break;
      }
      case 'greathelm':
      default:
        this.box(0.26, 0.3, 0.26, helmMat, 0, 0.02, 0, head);
        this.box(0.21, 0.028, 0.01, dark, 0, 0.05, 0.131, head, false);
        this.box(0.03, 0.18, 0.01, M.trim, 0, -0.03, 0.132, head, false);
        if (look.crest) this.box(0.045, 0.16, 0.26, M.crest, 0, 0.25, -0.01, head);
        break;
    }
    if (look.beard && look.helm !== 'antler' && look.helm !== 'greathelm') this.box(0.2, 0.11, 0.08, M.beard, 0, -0.13, 0.07, head);
  }

  // Builds a knight facing +z. Returns the parts the animator moves.
  _knight(look, weaponKind, offhandKind, size = 1) {
    const extra = [];
    const M = {
      mail: this.std(look.mail || '#8e949c', 'mail'),
      metal: this.std(look.metal || '#aab1bc', 'metal'),
      helm: this.std(look.helmColor || look.metal || '#aab1bc', 'metal'),
      skin: this.std(look.skin || '#e2b48a'),
      beard: this.std(look.beard || '#5a3a20'),
      dark: new THREE.MeshBasicMaterial({ color: '#0d0a08' }),
      trim: this.std(look.trim || PALETTE.goldCss, 'metal'),
      crest: this.std(look.crest || PALETTE.goldCss),
      gold: this.std(PALETTE.goldCss, 'metal'),
      leather: this.std('#4a2f1a', 'wood'),
      wood: this.std('#6b4423', 'wood'),
      boot: this.std('#3b2716', 'wood'),
      belt: this.std('#3b2716'),
      steel: this.std(look.blade || '#c9ced6', 'metal'),
      edge: this.std('#e8ecf2', 'metal'),
      leaf: this.std('#3f7a35', 'leaf'),
      antler: this.std(look.antler || '#cdbb9a', 'metal'),
      tabard: this.std(look.tabard),
      extra,
    };
    const tabardFace = new THREE.MeshStandardMaterial({ map: this._tabardTex(look), roughness: 0.88, flatShading: true });
    extra.push(tabardFace);

    const root = new THREE.Group();
    const fig = new THREE.Group();
    fig.scale.setScalar(size);
    root.add(fig);

    const legs = [-1, 1].map((s) => {
      const hip = new THREE.Group();
      hip.position.set(s * 0.11, HIP, 0);
      fig.add(hip);
      this.box(0.16, 0.44, 0.18, M.mail, 0, -0.22, 0, hip);
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);
      this.box(0.15, 0.4, 0.17, M.metal, 0, -0.2, 0, knee);
      this.box(0.17, 0.12, 0.28, M.boot, 0, -0.42, 0.05, knee);
      return { hip, knee, s };
    });

    const body = new THREE.Group();
    body.position.y = HIP;
    fig.add(body);
    const tabardMats = [M.tabard, M.tabard, M.tabard, M.tabard, tabardFace, tabardFace];
    this.box(0.48, 0.36, 0.31, M.tabard, 0, -0.1, 0, body);
    this.box(0.44, 0.54, 0.27, M.mail, 0, 0.33, 0, body);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.3), tabardMats);
    tab.position.set(0, 0.22, 0);
    tab.castShadow = true;
    body.add(tab);
    this.box(0.5, 0.07, 0.33, M.belt, 0, 0.02, 0, body);
    this.box(0.08, 0.08, 0.02, M.gold, 0, 0.02, 0.17, body);
    this.box(0.2, 0.1, 0.2, M.mail, 0, 0.64, 0, body);
    [-1, 1].forEach((s) => {
      const p = this.box(0.19, 0.1, 0.25, M.metal, s * 0.29, 0.62, 0, body);
      p.rotation.z = -s * 0.25;
    });
    const head = new THREE.Group();
    head.position.y = 0.82;
    body.add(head);
    this._helm(look, head, M);

    const arm = (x) => {
      const sh = new THREE.Group();
      sh.position.set(x, 0.56, 0);
      sh.rotation.order = 'XYZ';
      body.add(sh);
      this.box(0.12, 0.3, 0.13, M.mail, 0, -0.15, 0, sh);
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      sh.add(elbow);
      this.box(0.115, 0.27, 0.125, M.metal, 0, -0.135, 0, elbow);
      this.box(0.13, 0.1, 0.14, M.leather, 0, -0.3, 0, elbow);
      return { sh, elbow };
    };
    const R = arm(-0.29);
    const L = arm(0.29);
    const w = this._weapon(weaponKind, look, M);
    const weapon = new THREE.Group();
    weapon.position.y = -0.33;
    weapon.add(w.g);
    R.elbow.add(weapon);
    const off = this._offhand(offhandKind, look, M);
    off.position.set(0, -0.32, offhandKind === 'holly' ? 0.04 : 0.09);
    L.elbow.add(off);

    // Cape (or the Green Knight's cloak of leaves) hangs from the shoulders.
    let cape = null;
    if (look.cape || look.leafy) {
      cape = new THREE.Group();
      cape.position.set(0, 0.64, -0.17);
      body.add(cape);
      if (look.leafy) {
        this.box(0.58, 1.05, 0.05, M.leaf, 0, -0.5, 0, cape);
        const rr = rng(77);
        for (let i = 0; i < 8; i++) this.box(0.075, 0.2 + rr() * 0.35, 0.05, M.leaf, -0.26 + i * 0.075, -1.05 - rr() * 0.1, 0, cape);
        [-1, 1].forEach((s) => {
          this.box(0.26, 0.14, 0.32, M.leaf, s * 0.27, 0.0, 0.16, cape);
          this.box(0.16, 0.12, 0.2, M.leaf, s * 0.33, -0.12, 0.2, cape);
        });
        for (let i = 0; i < 6; i++) this.box(0.12, 0.12, 0.04, M.leaf, -0.18 + (i % 3) * 0.18, -0.35 - Math.floor(i / 3) * 0.3, 0.36, body);
      } else {
        const capeTex = pix(20, 40, (ctx, cw, ch) => {
          const base = rgb(look.cape);
          const rr = rng(base[2] + 5);
          for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { ctx.fillStyle = css(base, 0.86 + rr() * 0.14 - (y / ch) * 0.12); ctx.fillRect(x, y, 1, 1); }
          ctx.fillStyle = PALETTE.goldCss;
          ctx.fillRect(0, ch - 2, cw, 2);
          if (look.capeCharge) drawCharge(ctx, look.capeCharge, cw / 2, 14, cw * 0.85, PALETTE.goldCss, null);
        });
        const capeMat = new THREE.MeshStandardMaterial({ map: capeTex, roughness: 0.9, flatShading: true });
        extra.push(capeMat);
        const cm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.08, 0.03), [M.tabard, M.tabard, M.tabard, M.tabard, M.tabard, capeMat]);
        cm.position.y = -0.54;
        cm.castShadow = true;
        cape.add(cm);
      }
    }

    const mats = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        if (m.emissive && !mats.includes(m)) mats.push(m);
      });
    });
    return { root, fig, body, head, armR: R.sh, elbowR: R.elbow, armL: L.sh, elbowL: L.elbow, weapon, off, legs, cape, len: w.len, mats, weaponMats: [M.steel, M.edge] };
  }

  _lookFor(def) {
    if (def.look) return def.look;
    const p = def.palette;
    return { tabard: p.body, trim: p.trim, helm: 'greathelm', helmColor: p.helmColor || '#888', mail: p.sleeve, metal: p.legs, skin: p.skin };
  }

  // ---------- rigs handed to the combat code ----------

  buildEnemy(def) {
    const look = { ...this._lookFor(def), blade: def.palette.blade };
    const offKind = def.offhand === 'round' ? 'round' : def.offhand;
    const f = this._knight(look, def.weapon, offKind, (def.size || 1) * 1.0);
    f.root.position.set(0, 0, ENEMY_Z);
    f.root.rotation.y = ENEMY_TURN;
    this.content.add(f.root);
    const prox = { root: new P(), body: new P(), head: new P(), armL: new P(), armR: new P(), weapon: new P() };
    this.enemy = { ...f, prox, faded: false, reach: 0, elbow: 0.4, lastZ: ENEMY_Z, walk: 0, hp: null };
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
    this.player = {
      body3d: true, f, hp: null, flashUntil: 0,
      pose: { armR: 25, armRx: -0.3, elbowR: 0.6, weapon: -150, armL: -10, armLx: -0.5, elbowL: 0.9, bodyA: 0, bodyRx: 0, bodyY: 0, twist: 0, rootX: 0 },
    };
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

  _legs(f, stance, walk, crouch) {
    // stance: fighting stance with the left foot forward; walk: 0..1 swing amount.
    const t = this.time;
    f.legs.forEach(({ hip, knee, s }) => {
      const fwd = s > 0 ? 1 : -1;   // figure's left leg leads
      const swing = walk * Math.sin(t * 0.011 + (s > 0 ? 0 : Math.PI)) * 0.6;
      hip.rotation.x = -fwd * 0.28 * stance + swing - crouch * 0.35;
      hip.rotation.z = s * 0.1 * stance;
      knee.rotation.x = 0.25 * stance + Math.max(0, -swing) * 0.8 + crouch * 0.7;
    });
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
    v.body.position.set(r.body.x * K, HIP - r.body.y * K, 0);
    v.body.rotation.z = -r.body.angle * DEG;
    v.head.rotation.z = -r.head.angle * DEG;
    v.armL.rotation.z = -r.armL.angle * DEG;
    v.weapon.rotation.z = -r.weapon.angle * DEG;

    let reach = 0;
    let elbow = 0.45;
    let crouch = 0.15;
    if (e.state === ES.TELEGRAPH) { reach = -0.5 * Math.min(1, e.t / 260); elbow = 0.25; crouch = 0.25; }
    else if (e.state === ES.STRIKE) { reach = -0.8; elbow = 0; crouch = 0.35; }
    else if (e.state === ES.PARRIED) { reach = 0.3; elbow = 0.6; }
    else if (e.state === ES.STAGGERED) { elbow = 0.2; crouch = 0.5; }
    else if (e.state === ES.RECOVER) { elbow = 0.3; crouch = 0.3; }
    const k = Math.min(1, dt / (e.state === ES.STRIKE ? 40 : 120));
    v.reach += (reach - v.reach) * k;
    v.elbow += (elbow - v.elbow) * k;
    v.armR.rotation.z = -r.armR.angle * DEG;
    v.armR.rotation.x = v.reach;
    v.elbowR.rotation.x = -v.elbow;
    v.elbowL.rotation.x = -0.7;
    v.armL.rotation.x = -0.35;
    if (v.off) v.off.rotation.x = 1.05;   // keep the shield facing forward
    this._legs(v, e.state === ES.DEFEATED ? 0.3 : 1, v.walk, crouch);
    if (v.cape) v.cape.rotation.x = 0.1 + v.walk * 0.25 + Math.sin(this.time * 0.003) * 0.03;

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
    // Guard: sword up and ready, shield held in front.
    const T = { armR: 25, armRx: -0.3, elbowR: 0.6, weapon: -150, armL: -10, armLx: -0.5, elbowL: 0.9, bodyA: 0, bodyRx: 0.05, bodyY: 0, twist: 0, rootX: 0 };
    let speed = 110;
    let crouch = 0.2;
    let walk = 0;
    switch (pl.state) {
      case PS.DODGING: {
        const s = Math.sin(Math.PI * Math.min(1, pl.stateT / CONFIG.dodge.durationMs));
        const dir = pl.dodgeSide === 'left' ? -1 : 1;
        T.rootX = dir * 0.9 * s;
        T.bodyA = -dir * 12 * s;
        crouch = 0.2 + 0.5 * s;
        walk = s;
        speed = 1;
        break;
      }
      case PS.BLOCKING:
        Object.assign(T, { armLx: -1.35, armL: 38, elbowL: 0.25, bodyRx: 0.12, armR: 15, weapon: -25, elbowR: 0.3, twist: -0.15 });
        crouch = 0.4;
        speed = 45;
        break;
      case PS.STUNNED:
        Object.assign(T, { bodyRx: -0.3, armR: 45, weapon: -40, armL: 20, elbowR: 0.2 });
        crouch = 0.1;
        speed = 40;
        break;
      case PS.DEAD:
        Object.assign(T, { bodyRx: -1.45, bodyY: -0.4, armR: 110, armL: -110, weapon: 0, elbowR: 0, elbowL: 0 });
        crouch = 0.8;
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
        T.armR = c ? c[0] : angFor(-dx, -dy - 0.4 * (1 - Math.abs(dy)));
        T.weapon = c ? c[1] : -dx * 25;
        T.armRx = 0.25;
        T.elbowR = 0.5;
        T.twist = 0.35;
        T.bodyA = -dx * 6;
      } else if (sp < 0.7) {
        T.armR = angFor(dx, dy + 0.35);
        T.weapon = 0;
        T.armRx = -0.95;
        T.elbowR = 0;
        T.twist = -0.4;
        T.bodyA = dx * 8;
        T.bodyRx = 0.18;
        crouch = 0.45;
      }
      speed = 18;
    }
    const k = speed <= 1 ? 1 : Math.min(1, dt / speed);
    const P0 = v.pose;
    for (const key of Object.keys(T)) P0[key] += (T[key] - P0[key]) * k;

    f.root.position.x = P0.rootX;
    f.body.position.y = HIP + P0.bodyY - crouch * 0.06 + Math.sin(now / 650) * 0.008;
    f.body.rotation.set(P0.bodyRx, P0.twist, -P0.bodyA * DEG);
    f.armR.rotation.set(P0.armRx, 0, -P0.armR * DEG);
    f.elbowR.rotation.x = -P0.elbowR;
    f.weapon.rotation.z = -P0.weapon * DEG;
    f.armL.rotation.set(P0.armLx, 0, -P0.armL * DEG);
    f.elbowL.rotation.x = -P0.elbowL;
    if (f.off) f.off.rotation.x = -(P0.armLx - P0.elbowL);
    this._legs(f, pl.state === PS.DEAD ? 0.2 : 1, walk, crouch);
    if (f.cape) f.cape.rotation.x = 0.12 + Math.abs(P0.rootX) * 0.3 + Math.sin(now * 0.003) * 0.04;

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
    cam.position.y += Math.sin(now / 1900) * 0.02;
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

    // Candle flicker, banner sway, crowd.
    (this.candles || []).forEach((c) => {
      c.light.intensity = c.base * (0.88 + Math.sin(now * 0.017 + c.phase) * 0.06 + Math.sin(now * 0.041 + c.phase * 3) * 0.05);
    });
    (this.banners || []).forEach((b) => { b.rotation.z = Math.sin(now * 0.0011 + b.userData.phase) * 0.03; });
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
