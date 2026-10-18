import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { VIEW, PALETTE } from '../config.js';
import { paintScene, BG_MARGIN } from '../art/Backgrounds.js';
import { drawShieldShape, drawDevice } from '../art/Rig.js';
import { ES } from '../combat/Enemy.js';

// 3D view for the duel. The combat code still animates "proxy" objects with the
// same 2D pose data (x, y, angle, scale, alpha); each frame those proxies are
// mapped onto a Three.js scene drawn under the Phaser HUD canvas.

const FOV = 42;
const EYE = 1.6;
const ENEMY_Z = -3.4;
const HIP = 0.95;
const K = 0.0048;            // metres per logical pixel at the enemy's distance
const SWORD_DEPTH = 0.62;
const SHIELD_DEPTH = 0.55;
const MAX_PIXEL_RATIO = 1.75;
const INK_COLOR = 0x2a1d14;
const DEG = Math.PI / 180;

// Stand-in for a Phaser container: just the properties tweens and poses touch.
export class P {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.alpha = 1;
    this.scaleX = 1;
    this.scaleY = 1;
  }

  get scale() { return this.scaleX; }

  set scale(v) { this.scaleX = v; this.scaleY = v; }

  setPosition(x, y) { this.x = x; if (y !== undefined) this.y = y; return this; }

  setScale(x, y) { this.scaleX = x; this.scaleY = y ?? x; return this; }

  setAngle(a) { this.angle = a; return this; }

  setAlpha(a) { this.alpha = a; return this; }

  setDepth() { return this; }

  setVisible() { return this; }
}

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

function at(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  return mesh;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const ENV = {
  forest: { ground: '#a7a066', fog: '#e9d9b0', sky: 0xfff4dc, earth: 0x6b5a3a },
  hall: { ground: '#8f7a5a', fog: '#c9b48a', sky: 0xfff0d8, earth: 0x5a4a35 },
  road: { ground: '#a88f62', fog: '#d9a982', sky: 0xffe2c4, earth: 0x6a4a35 },
  field: { ground: '#9aa85e', fog: '#e6d6ae', sky: 0xfff6e0, earth: 0x606a35 },
  chapel: { ground: '#e9eef0', fog: '#cfd6da', sky: 0xf2f6ff, earth: 0x8a9aa5 },
};

export class World3D {
  constructor(game) {
    this.game = game;
    const parent = document.getElementById('game');
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'absolute', left: '0', top: '0', zIndex: '0', display: 'none', pointerEvents: 'none' });
    parent.insertBefore(this.canvas, parent.firstChild);
    Object.assign(game.canvas.style, { position: 'relative', zIndex: '1' });

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.gradient = new THREE.DataTexture(new Uint8Array([70, 150, 215, 255]), 4, 1, THREE.RedFormat);
    this.gradient.minFilter = THREE.NearestFilter;
    this.gradient.magFilter = THREE.NearestFilter;
    this.gradient.needsUpdate = true;
    this.inkMat = new THREE.MeshBasicMaterial({ color: INK_COLOR, side: THREE.BackSide });

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, VIEW.W / VIEW.H, 0.05, 60);
    this.scene.add(this.camera);
    this.fp = new THREE.Group();
    this.camera.add(this.fp);

    this.hemi = new THREE.HemisphereLight(0xfff4dc, 0x6b5a3a, 1.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
    this.sun.position.set(-4, 7, 3);
    this.sun.target.position.set(0, 1, ENEMY_Z);
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight(0xd8e2ff, 0.6);
    fill.position.set(0, 2, 2);
    this.camera.add(fill);

    this.content = new THREE.Group();
    this.scene.add(this.content);
    this.lastRect = '';
    this.reach = 0;
    this.v = new THREE.Vector3();
  }

  // ---------- materials and parts ----------

  toon(color, extra = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.gradient, ...extra });
  }

  // A toon-shaded mesh with an inverted-hull ink outline of roughly `t` thickness.
  part(geo, color, t = 0.012, mat = null) {
    const m = new THREE.Mesh(geo, mat || this.toon(color));
    if (t > 0) {
      geo.computeBoundingBox();
      const size = new THREE.Vector3();
      const c = new THREE.Vector3();
      geo.boundingBox.getSize(size);
      geo.boundingBox.getCenter(c);
      const o = new THREE.Mesh(geo, this.inkMat);
      o.scale.set(1 + (2 * t) / Math.max(size.x, 1e-3), 1 + (2 * t) / Math.max(size.y, 1e-3), 1 + (2 * t) / Math.max(size.z, 1e-3));
      o.position.set(c.x - c.x * o.scale.x, c.y - c.y * o.scale.y, c.z - c.z * o.scale.z);
      o.userData.outline = true;
      m.add(o);
    }
    return m;
  }

  decal(w, h, tex, extra = {}) {
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.toon(0xffffff, { map: tex, transparent: true, alphaTest: 0.35, ...extra }));
  }

  extrude(points, depth, curves = null) {
    const s = new THREE.Shape();
    s.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]);
      else s.lineTo(p[0], p[1]);
    }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -depth / 2);
    return g;
  }

  // ---------- canvas sync and lifecycle ----------

  show(on) {
    this.canvas.style.display = on ? 'block' : 'none';
    if (on) this.syncCanvas(true);
  }

  syncCanvas(force = false) {
    const gc = this.game.canvas;
    const key = `${gc.offsetLeft},${gc.offsetTop},${gc.offsetWidth},${gc.offsetHeight}`;
    if (!force && key === this.lastRect) return;
    this.lastRect = key;
    this.canvas.style.left = `${gc.offsetLeft}px`;
    this.canvas.style.top = `${gc.offsetTop}px`;
    this.renderer.setSize(gc.offsetWidth || 1, gc.offsetHeight || 1);
    this.camera.aspect = VIEW.W / VIEW.H;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    const kill = (root) => {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material !== this.inkMat) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      while (root.children.length) root.remove(root.children[0]);
    };
    kill(this.content);
    kill(this.fp);
    this.enemy = null;
    this.player = null;
    this.snow = null;
    this.scene.fog = null;
  }

  // Scene point -> logical screen coordinates used by the Phaser HUD.
  project(v) {
    const p = v.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * VIEW.W, y: ((1 - p.y) / 2) * VIEW.H };
  }

  // ---------- environment ----------

  buildEnv(kind) {
    const env = ENV[kind] || ENV.forest;
    const g = new THREE.Group();
    this.content.add(g);
    const rand = rng(kind.length * 977);

    this.hemi.color.set(env.sky);
    this.hemi.groundColor.set(env.earth);
    this.scene.fog = new THREE.Fog(env.fog, 10, 26);

    // Painted horizon wrapped around the arena.
    const pw = VIEW.W + BG_MARGIN * 2;
    const tex = canvasTexture(Math.round(pw * 1.3), Math.round(VIEW.H * 1.3), (ctx, w, h) => {
      ctx.scale(1.3, 1.3);
      paintScene(ctx, kind, pw, VIEW.H);
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    const arc = 2.4;
    const back = new THREE.Mesh(
      new THREE.CylinderGeometry(19, 19, 12, 48, 1, true, Math.PI - arc / 2, arc),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
    );
    back.position.y = 3.1;
    g.add(back);

    // Ground and the duelling circle.
    let groundMat;
    if (kind === 'hall') {
      const tile = canvasTexture(64, 64, (ctx) => {
        ctx.fillStyle = '#8f7a5a';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#7a6748';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillRect(32, 32, 32, 32);
      });
      tile.wrapS = THREE.RepeatWrapping;
      tile.wrapT = THREE.RepeatWrapping;
      tile.repeat.set(18, 18);
      groundMat = this.toon(0xffffff, { map: tile });
    } else {
      groundMat = this.toon(env.ground);
    }
    const ground = new THREE.Mesh(new THREE.CircleGeometry(18.5, 48), groundMat);
    ground.rotation.x = -Math.PI / 2;
    g.add(ground);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.38, 48), new THREE.MeshBasicMaterial({ color: INK_COLOR, transparent: true, opacity: 0.35 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.01, ENEMY_Z + 0.6);
    g.add(ring);

    // Props around the edge of the arena (kept out of the line of sight).
    const around = (n, rMin, rMax, fn) => {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (rand() - 0.5) * 2.6;
        const r = rMin + rand() * (rMax - rMin);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (z > -5 || (Math.abs(x) < 3 && z > -9)) continue;
        fn(x, z, 0.8 + rand() * 0.5);
      }
    };
    const tree = (x, z, s) => {
      const t = new THREE.Group();
      t.add(at(this.part(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 7), '#5a3a20', 0), 0, 0.7, 0));
      const crown = this.part(new THREE.IcosahedronGeometry(0.9, 1), rand() > 0.5 ? '#4f7a3a' : '#6f8f4a', 0);
      crown.position.y = 2.0;
      crown.scale.set(1, 1.2, 1);
      t.add(crown);
      t.position.set(x, 0, z);
      t.scale.setScalar(s);
      g.add(t);
    };
    const pine = (x, z, s, snowy = false) => {
      const t = new THREE.Group();
      t.add(at(this.part(new THREE.CylinderGeometry(0.1, 0.12, 0.6, 6), '#4a2f1a', 0), 0, 0.3, 0));
      [0, 1, 2].forEach((i) => {
        const c = this.part(new THREE.ConeGeometry(0.9 - i * 0.22, 1.2, 8), i === 2 && snowy ? '#eef3f4' : '#2f5a3a', 0);
        c.position.y = 1.0 + i * 0.6;
        t.add(c);
      });
      t.position.set(x, 0, z);
      t.scale.setScalar(s * 1.3);
      g.add(t);
    };

    if (kind === 'forest') {
      around(40, 8, 16, tree);
    } else if (kind === 'road') {
      around(36, 8, 16, (x, z, s) => pine(x, z, s));
      const road = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 30), this.toon('#c9b07a'));
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.005, -12);
      g.add(road);
    } else if (kind === 'chapel') {
      around(30, 8, 16, (x, z, s) => pine(x, z, s, true));
      const mound = this.part(new THREE.SphereGeometry(4, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), '#4f8a45', 0.03);
      mound.scale.set(1.3, 0.8, 1);
      mound.position.set(0, 0, -11);
      g.add(mound);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(4.05, 24, 8, 0, Math.PI * 2, 0, Math.PI / 5), this.toon('#f4f7f8'));
      cap.scale.copy(mound.scale);
      cap.position.copy(mound.position);
      g.add(cap);
      const door = this.part(new THREE.BoxGeometry(1.2, 1.8, 0.2), '#1d2a1d', 0.03);
      door.position.set(0, 0.9, -7.95);
      g.add(door);
      // falling snow
      const n = 500;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (rand() - 0.5) * 16;
        pos[i * 3 + 1] = rand() * 6;
        pos[i * 3 + 2] = -rand() * 12 + 1;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.9 }));
      g.add(this.snow);
    } else if (kind === 'hall') {
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const z = -1 - i * 3.2;
          const x = sx * (3.6 + (i % 2) * 0.2);
          const col = this.part(new THREE.CylinderGeometry(0.35, 0.42, 6, 12), '#b6a283', 0.03);
          col.position.set(x, 3, z);
          g.add(col);
          const base = this.part(new THREE.BoxGeometry(1.1, 0.35, 1.1), '#9a876a', 0.02);
          base.position.set(x, 0.17, z);
          g.add(base);
          if (i < 3) {
            const red = (i + (sx > 0 ? 1 : 0)) % 2 === 0;
            const bt = canvasTexture(80, 200, (ctx, w, h) => {
              ctx.fillStyle = red ? PALETTE.vermilionCss : PALETTE.lapisCss;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(w, 0);
              ctx.lineTo(w, h);
              ctx.lineTo(w / 2, h - 30);
              ctx.lineTo(0, h);
              ctx.closePath();
              ctx.fill();
              ctx.lineWidth = 6;
              ctx.strokeStyle = PALETTE.inkCss;
              ctx.stroke();
              ctx.fillStyle = PALETTE.goldCss;
              ctx.font = 'bold 60px serif';
              ctx.textAlign = 'center';
              ctx.fillText('★', w / 2, 90);
            });
            const ban = this.decal(1.0, 2.5, bt, { side: THREE.DoubleSide });
            ban.position.set(x - sx * 0.55, 3.6, z - 0.2);
            ban.rotation.y = -sx * 0.9;
            g.add(ban);
          }
        }
      }
    } else if (kind === 'field') {
      around(14, 9, 15, (x, z, s) => {
        const tent = this.part(new THREE.ConeGeometry(1.4, 2.4, 10), rand() > 0.5 ? PALETTE.vermilionCss : '#f1e3c4', 0.03);
        tent.position.set(x, 1.2, z);
        tent.scale.setScalar(s);
        g.add(tent);
      });
      for (let x = -9; x <= 9; x += 0.9) {
        if (Math.abs(x) < 1) continue;
        const post = this.part(new THREE.BoxGeometry(0.12, 0.8, 0.12), Math.round(x / 0.9) % 2 ? PALETTE.vermilionCss : '#f1e3c4', 0.012);
        post.position.set(x, 0.4, -7);
        g.add(post);
      }
      const rail = this.part(new THREE.BoxGeometry(18, 0.08, 0.08), '#f1e3c4', 0.012);
      rail.position.set(0, 0.7, -7);
      g.add(rail);
    }
  }

  // ---------- enemy ----------

  _weapon(kind, p, mats) {
    const g = new THREE.Group();
    const steel = this.toon(p.blade || '#c9ccd4');
    mats.push(steel);
    const add = (m, x, y, z = 0) => { m.position.set(x, y, z); g.add(m); return m; };
    if (kind === 'axe' || kind === 'greataxe') {
      const big = kind === 'greataxe';
      const len = big ? 1.2 : 0.64;
      add(this.part(new THREE.CylinderGeometry(big ? 0.028 : 0.022, big ? 0.028 : 0.022, len, 8), '#6b4423', 0.01), 0, -len / 2 + 0.03);
      const hs = big ? 0.3 : 0.17;
      const hy = -len + (big ? 0.12 : 0.08);
      const geo = this.extrude([
        [0.01, hy + hs * 0.35],
        [hs * 1.1, hy + hs * 0.7, hs, hy],
        [hs * 1.1, hy - hs * 0.7, 0.01, hy - hs * 0.35],
      ], big ? 0.03 : 0.022);
      add(this.part(geo, null, 0.01, steel), 0, 0);
      return { g, len: len - 0.02 };
    }
    const fal = kind === 'falchion';
    const len = fal ? 0.78 : 0.95;
    add(this.part(new THREE.SphereGeometry(0.035, 10, 8), p.hilt || PALETTE.goldCss, 0.008), 0, 0.06);
    add(this.part(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8), '#5a3a20', 0.008), 0, -0.02);
    add(this.part(new THREE.BoxGeometry(0.26, 0.04, 0.05), p.hilt || PALETTE.goldCss, 0.008), 0, -0.1);
    const bl = len - 0.12;
    const pts = fal
      ? [[-0.03, 0], [0.03, 0], [0.06, -bl * 0.75], [0.06, -bl, -0.03, -bl], [-0.03, 0]]
      : [[-0.028, 0], [0.028, 0], [0.028, -bl + 0.08], [0, -bl], [-0.028, -bl + 0.08]];
    add(this.part(this.extrude(pts, 0.014), null, 0.008, steel), 0, -0.12);
    return { g, len };
  }

  _offhand(kind, p) {
    const g = new THREE.Group();
    if (kind === 'holly') {
      const stick = this.part(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 6), '#5a3a20', 0.006);
      stick.position.y = -0.22;
      g.add(stick);
      for (let i = 0; i < 7; i++) {
        const leaf = this.part(new THREE.SphereGeometry(0.05, 8, 6), '#2f6b2a', 0.006);
        leaf.scale.set(0.5, 1, 0.3);
        leaf.position.set((i % 2 ? 1 : -1) * 0.05, -0.05 - i * 0.06, 0.02);
        leaf.rotation.z = (i % 2 ? -1 : 1) * 0.8;
        g.add(leaf);
      }
      [[-0.02, -0.12], [0.03, -0.24], [-0.01, -0.34]].forEach(([x, y]) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), this.toon(PALETTE.vermilionCss));
        b.position.set(x, y, 0.05);
        g.add(b);
      });
      return g;
    }
    const r = kind === 'buckler' ? 0.17 : 0.3;
    const face = canvasTexture(256, 300, (ctx) => drawShieldShape(ctx, kind === 'heater' ? 'heater' : 'round', 128, 128, 100, p.shield, p.shieldCharge));
    const m = r / 100;
    if (kind === 'heater') {
      const s = 0.27;
      const geo = this.extrude([
        [-s, s * 0.9], [s, s * 0.9], [s, 0],
        [s * 0.9, -s * 0.9, 0, -s * 1.3],
        [-s * 0.9, -s * 0.9, -s, 0],
      ], 0.04);
      g.add(this.part(geo, p.shield, 0.012));
      const d = this.decal(256 * (s / 100), 300 * (s / 100), face);
      d.position.set(0, -(150 - 128) * (s / 100), 0.022);
      g.add(d);
    } else {
      const disk = this.part(new THREE.CylinderGeometry(r, r, 0.045, 28), '#7a4b2a', 0.012);
      disk.rotation.x = Math.PI / 2;
      g.add(disk);
      const d = this.decal(256 * m, 300 * m, face);
      d.position.set(0, -(150 - 128) * m, 0.025);
      g.add(d);
    }
    return g;
  }

  _head(p, add) {
    const head = new THREE.Group();
    const face = this.part(new THREE.SphereGeometry(0.13, 18, 14), p.skin);
    face.scale.set(1, 1.12, 1);
    if (p.helm === 'wild') {
      for (let i = 0; i < 14; i++) {
        const a = -0.4 + (i / 13) * (Math.PI + 0.8);
        const tuft = this.part(new THREE.SphereGeometry(0.075, 10, 8), p.hair, 0.008);
        tuft.position.set(Math.cos(a) * 0.16, Math.sin(a) * 0.17 + 0.03, -0.05);
        head.add(tuft);
      }
    }
    if (p.helm !== 'greathelm') {
      head.add(face);
      const black = new THREE.MeshBasicMaterial({ color: INK_COLOR });
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), black);
        eye.position.set(s * 0.045, 0.02, 0.118);
        head.add(eye);
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.01), black);
        brow.position.set(s * 0.045, 0.055, 0.122);
        brow.rotation.z = s * -0.25;
        head.add(brow);
      }
      if (p.beard) {
        const beard = this.part(new THREE.SphereGeometry(0.12, 14, 10), p.beard, 0.008);
        beard.scale.set(1, 1.15, 0.7);
        beard.position.set(0, -0.1, 0.06);
        head.add(beard);
      }
    }
    if (p.helm === 'spangen') {
      const dome = this.part(new THREE.SphereGeometry(0.145, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), p.helmColor);
      dome.position.y = 0.03;
      head.add(dome);
      const band = this.part(new THREE.CylinderGeometry(0.148, 0.148, 0.035, 18), PALETTE.goldCss, 0.006);
      band.position.y = 0.03;
      head.add(band);
      const nasal = this.part(new THREE.BoxGeometry(0.035, 0.13, 0.03), p.helmColor, 0.006);
      nasal.position.set(0, -0.03, 0.14);
      head.add(nasal);
    } else if (p.helm === 'greathelm') {
      const helm = this.part(new THREE.CylinderGeometry(0.155, 0.16, 0.34, 18), p.helmColor);
      helm.position.y = 0.01;
      head.add(helm);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.012), this.toon(p.trim));
      cross.position.set(0, 0.01, 0.158);
      head.add(cross);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.02), new THREE.MeshBasicMaterial({ color: 0x0a0806 }));
      slit.position.set(0, 0.04, 0.155);
      head.add(slit);
      if (p.crest) {
        const crest = this.part(new THREE.BoxGeometry(0.035, 0.18, 0.3), p.crest, 0.008);
        crest.position.set(0, 0.25, -0.02);
        crest.rotation.x = 0.25;
        head.add(crest);
      }
    } else if (p.helm === 'hood') {
      const hood = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 16, 12, Math.PI, Math.PI, 0, Math.PI * 0.8),
        this.toon(p.helmColor, { side: THREE.DoubleSide }),
      );
      hood.position.set(0, 0.03, 0.02);
      hood.scale.set(1, 1.12, 1.1);
      head.add(hood);
      const cowl = this.part(new THREE.TorusGeometry(0.17, 0.035, 8, 20), p.helmColor, 0.006);
      cowl.position.set(0, -0.14, 0);
      cowl.rotation.x = Math.PI / 2;
      head.add(cowl);
    }
    add(head);
    return head;
  }

  buildEnemy(def) {
    const p = def.palette;
    const root = new THREE.Group();
    root.position.set(0, 0, ENEMY_Z);
    this.content.add(root);
    const sizeG = new THREE.Group();
    sizeG.scale.setScalar(def.size || 1);
    root.add(sizeG);

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.012, ENEMY_Z);
    this.content.add(shadow);

    for (const s of [-1, 1]) {
      const leg = this.part(new THREE.CylinderGeometry(0.085, 0.075, 0.82, 10), p.legs);
      leg.position.set(s * 0.12, 0.5, 0);
      sizeG.add(leg);
      const boot = this.part(new THREE.BoxGeometry(0.15, 0.13, 0.27), p.boots);
      boot.position.set(s * 0.12, 0.065, 0.04);
      sizeG.add(boot);
    }

    const body = new THREE.Group();
    body.position.y = HIP;
    sizeG.add(body);
    const skirt = this.part(new THREE.CylinderGeometry(0.26, 0.4, 0.42, 14), p.body);
    skirt.position.y = -0.15;
    skirt.scale.z = 0.8;
    body.add(skirt);
    const torso = this.part(new THREE.CylinderGeometry(0.3, 0.25, 0.62, 14), p.body);
    torso.position.y = 0.3;
    torso.scale.z = 0.7;
    body.add(torso);
    const belt = this.part(new THREE.CylinderGeometry(0.258, 0.258, 0.07, 14), p.belt, 0.006);
    belt.position.y = 0.02;
    belt.scale.z = 0.72;
    body.add(belt);
    const buckle = this.part(new THREE.BoxGeometry(0.07, 0.08, 0.03), PALETTE.goldCss, 0.006);
    buckle.position.set(0, 0.02, 0.19);
    body.add(buckle);
    const dev = canvasTexture(128, 128, (ctx) => {
      ctx.translate(64, 64);
      ctx.scale(1.4, 1.4);
      drawDevice(ctx, p);
    });
    const device = this.decal(0.3, 0.3, dev);
    device.position.set(0, 0.34, 0.205);
    body.add(device);
    for (const s of [-1, 1]) {
      const sh = this.part(new THREE.SphereGeometry(0.105, 12, 10), p.sleeve);
      sh.position.set(s * 0.3, 0.55, 0);
      body.add(sh);
    }
    const neck = this.part(new THREE.CylinderGeometry(0.065, 0.065, 0.12, 10), p.skin, 0.006);
    neck.position.y = 0.66;
    body.add(neck);
    const head = this._head(p, (h) => { h.position.y = 0.8; body.add(h); });

    const arm = (x) => {
      const g = new THREE.Group();
      g.position.set(x, 0.54, 0);
      g.rotation.order = 'XYZ';
      const sleeve = this.part(new THREE.CylinderGeometry(0.07, 0.06, 0.56, 10), p.sleeve);
      sleeve.position.y = -0.28;
      g.add(sleeve);
      const hand = this.part(new THREE.SphereGeometry(0.075, 12, 10), p.hand);
      hand.position.y = -0.58;
      g.add(hand);
      body.add(g);
      return g;
    };
    const armR = arm(-0.33);   // enemy's right hand = screen left
    const armL = arm(0.33);
    const weaponMats = [];
    const w = this._weapon(def.weapon, p, weaponMats);
    const weapon = new THREE.Group();
    weapon.position.y = -0.6;
    weapon.add(w.g);
    armR.add(weapon);
    if (def.offhand) {
      const off = this._offhand(def.offhand, p);
      off.position.set(0, -0.6, def.offhand === 'holly' ? 0.05 : 0.1);
      armL.add(off);
    }

    const mats = [];
    root.traverse((o) => { if (o.material && !o.userData.outline && o.material.emissive) mats.push(o.material); });

    const prox = { root: new P(), body: new P(), head: new P(), armL: new P(), armR: new P(), weapon: new P() };
    const view = this;
    this.enemy = { root, sizeG, body, head, armR, armL, weapon, shadow, len: w.len, prox, mats, def, faded: false };
    prox.root.flash = (ms) => {
      mats.forEach((m) => m.emissive.setRGB(0.9, 0.9, 0.85));
      setTimeout(() => mats.forEach((m) => m.emissive.setRGB(0, 0, 0)), ms + 15);
    };
    return {
      ...prox,
      weaponLen: w.len / K,
      setWeaponTint(c) {
        weaponMats.forEach((m) => {
          if (!m.userData.base) m.userData.base = m.color.clone();
          if (c === null) {
            m.color.copy(m.userData.base);
            m.emissive.setRGB(0, 0, 0);
          } else {
            m.color.set(0xe0301c);
            m.emissive.setRGB(0.45, 0.04, 0.02);
          }
        });
      },
      tip(frac = 1) { return view.project(weapon.localToWorld(view.v.set(0, -w.len * frac, 0))); },
      headPoint() { return view.project(head.localToWorld(view.v.set(0, 0.28, 0))); },
      chestPoint() { return view.project(body.localToWorld(view.v.set(0, 0.35, 0.2))); },
    };
  }

  _syncEnemy(e, dt) {
    const v = this.enemy;
    if (!v) return;
    const r = v.prox;
    const fwd = r.root.scaleX / e.size - 1;
    v.root.position.set((r.root.x - e.baseX) * K, -(r.root.y - e.baseY) * K, ENEMY_Z + fwd * 5);
    v.root.rotation.z = -r.root.angle * DEG;
    v.shadow.position.x = v.root.position.x;
    v.shadow.position.z = v.root.position.z;
    v.body.position.set(r.body.x * K, HIP - r.body.y * K, 0);
    v.body.rotation.z = -r.body.angle * DEG;
    v.head.rotation.z = -r.head.angle * DEG;
    v.armL.rotation.z = -r.armL.angle * DEG;
    v.weapon.rotation.z = -r.weapon.angle * DEG;

    // Swing depth: wind-ups lean back, strikes come at you.
    let reach = 0;
    if (e.state === ES.TELEGRAPH) reach = -0.5 * Math.min(1, e.t / 260);
    else if (e.state === ES.STRIKE) reach = -0.75;
    else if (e.state === ES.PARRIED) reach = 0.3;
    const k = Math.min(1, dt / (e.state === ES.STRIKE ? 40 : 120));
    this.reach += (reach - this.reach) * k;
    v.armR.rotation.z = -r.armR.angle * DEG;
    v.armR.rotation.x = this.reach;

    const a = r.root.alpha;
    if (a < 0.999 || v.faded) {
      v.faded = true;
      v.root.traverse((o) => {
        if (o.material) {
          o.material.transparent = true;
          o.material.opacity = a;
        }
      });
      v.shadow.material.opacity = 0.25 * a;
      if (a >= 0.999) v.faded = false;
    }
  }

  // ---------- first-person sword and shield ----------

  _mpp(depth) {
    return (2 * depth * Math.tan((FOV / 2) * DEG)) / VIEW.H;
  }

  _fpPos(x, y, depth, out) {
    const halfH = depth * Math.tan((FOV / 2) * DEG);
    const halfW = halfH * (VIEW.W / VIEW.H);
    return out.set(((x / VIEW.W) * 2 - 1) * halfW, (1 - (y / VIEW.H) * 2) * halfH, -depth);
  }

  buildPlayer(sword, shield, leftHanded) {
    const W = VIEW.W;
    const H = VIEW.H;
    const side = leftHanded ? -1 : 1;
    const swordHome = { x: W / 2 + side * W * 0.3, y: H + 20, angle: side * 8 };
    const shieldHome = { x: W / 2 - side * W * 0.31, y: H + 40, angle: side * 6 };
    const swordArm = new P(swordHome.x, swordHome.y).setAngle(swordHome.angle);
    const shieldP = new P(shieldHome.x, shieldHome.y).setAngle(shieldHome.angle);

    // Modelled in "logical pixel" units, then scaled to metres at its depth.
    const sg = new THREE.Group();
    const arm = this.part(new THREE.CylinderGeometry(30, 44, 210, 14), '#9aa1ad', 3);
    arm.position.y = 95;
    sg.add(arm);
    const cuff = this.part(new THREE.CylinderGeometry(42, 44, 28, 14), PALETTE.lapisCss, 2);
    cuff.position.y = 60;
    sg.add(cuff);
    const fist = this.part(new THREE.SphereGeometry(36, 14, 12), '#b7bcc6', 3);
    fist.position.y = 205;
    fist.scale.set(1, 0.9, 0.95);
    sg.add(fist);
    const hilt = new THREE.Group();
    hilt.position.y = 205;
    hilt.add(at(this.part(new THREE.CylinderGeometry(7, 7, 50, 8), '#4a2f1a', 2), 0, 0, 0));
    hilt.add(at(this.part(new THREE.SphereGeometry(11, 10, 8), sword.hilt, 2), 0, -32, 0));
    hilt.add(at(this.part(new THREE.BoxGeometry(72, 12, 14), sword.hilt, 2), 0, 30, 0));
    const blade = this.part(this.extrude([[-9, 0], [9, 0], [9, 255], [0, 290], [-9, 255]], 6), sword.color, 2);
    blade.position.y = 36;
    hilt.add(blade);
    sg.add(hilt);
    this.fp.add(sg);

    const shg = new THREE.Group();
    const kind = shield.id === 'targe' ? 'round' : 'heater';
    const face = canvasTexture(260, 300, (ctx) => drawShieldShape(ctx, kind, 130, 130, 112, shield.field, shield.charge));
    if (kind === 'round') {
      const disk = this.part(new THREE.CylinderGeometry(112, 112, 16, 32), '#7a4b2a', 3);
      disk.rotation.x = Math.PI / 2;
      shg.add(disk);
    } else {
      const s = 112;
      shg.add(this.part(this.extrude([
        [-s, s * 0.9], [s, s * 0.9], [s, 0],
        [s * 0.9, -s * 0.9, 0, -s * 1.3],
        [-s * 0.9, -s * 0.9, -s, 0],
      ], 16), shield.field, 3));
    }
    const d = this.decal(260, 300, face);
    d.position.set(0, -20, 9);
    shg.add(d);
    this.fp.add(shg);

    this.player = { sg, shg, swordArm, shieldP, side };
    return { swordArm, shield: shieldP, swordHome, shieldHome, side };
  }

  _syncPlayer() {
    const v = this.player;
    if (!v) return;
    const a = v.swordArm;
    const ms = this._mpp(SWORD_DEPTH);
    this._fpPos(a.x, a.y, SWORD_DEPTH, v.sg.position);
    v.sg.scale.set(ms * a.scaleX, ms * a.scaleY, ms);
    v.sg.rotation.set(-0.35, -v.side * 0.3, -a.angle * DEG, 'YXZ');

    const s = v.shieldP;
    const mh = this._mpp(SHIELD_DEPTH);
    this._fpPos(s.x, s.y, SHIELD_DEPTH, v.shg.position);
    v.shg.scale.setScalar(mh * s.scaleX);
    const raised = Math.min(1, Math.max(0, (s.scaleX - 1) / 0.12));
    v.shg.rotation.set(-0.15, v.side * 0.55 * (1 - raised), -s.angle * DEG, 'YXZ');
  }

  // ---------- per-frame ----------

  render(duel, dt) {
    this.syncCanvas();
    const cam = this.camera;
    const wx = duel.world ? duel.world.x : 0;
    const roll = duel.world ? duel.world.angle * DEG : 0;
    cam.position.set(-wx * 0.0045, EYE, 0);
    const sh = duel.cameras.main.shakeEffect;
    if (sh && sh.isRunning) {
      cam.position.x += (sh._offsetX || 0) * 0.004;
      cam.position.y += (sh._offsetY || 0) * 0.004;
    }
    cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    cam.lookAt(-wx * 0.0012, 1.28, ENEMY_Z);

    if (duel.enemy) this._syncEnemy(duel.enemy, dt);
    this._syncPlayer();

    if (this.snow && dt > 0) {
      const pos = this.snow.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 0.0006;
        if (y < 0) y += 6;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    this.renderer.render(this.scene, cam);
  }
}
