import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
import { PALETTE } from '../../config.js';
import { drawCharge } from '../../art/Heraldry.js';

// Procedural surface detail for the knights: brushed and scratched steel,
// riveted plate, ring mail, woven cloth, grained leather and wood. Maps are
// greyscale so one texture serves every colour; heraldry gets its own textures.

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map();

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

function tex(key, w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const t = new THREE.CanvasTexture(canvas(w, h, draw));
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  t.userData.keep = true;
  cache.set(key, t);
  return t;
}

// Brushed steel with scratches and darker worn edges.
export function steelMap() {
  return tex('steel', 128, 128, (ctx, w, h) => {
    const r = rng(11);
    ctx.fillStyle = '#d4d4d4';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${r() * 0.12})` : `rgba(0,0,0,${r() * 0.1})`;
      ctx.fillRect(x, 0, 1, h);
    }
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = r() > 0.4 ? `rgba(255,255,255,${0.15 + r() * 0.3})` : `rgba(40,40,40,${0.15 + r() * 0.25})`;
      ctx.lineWidth = 0.6 + r();
      ctx.beginPath();
      const x = r() * w;
      const y = r() * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30);
      ctx.stroke();
    }
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(30,25,20,${r() * 0.18})`;
      ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
    }
  });
}

// Plate with a raised rivet line along one edge (for lames and pauldrons).
export function plateBump() {
  return tex('plateBump', 64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(0, 0, w, 4);
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(0, 4, w, 2);
    for (let x = 4; x < w; x += 10) {
      const g = ctx.createRadialGradient(x, 12, 0, x, 12, 3);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#808080');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, 12, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { srgb: false });
}

// Interlocking rings.
export function mailMap() {
  return tex('mail', 64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h + 8; y += 6) {
      for (let x = 0; x < w + 8; x += 8) {
        const ox = (y / 6) % 2 ? 4 : 0;
        ctx.strokeStyle = '#d8d8d8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(x + ox, y, 3.4, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(x + ox - 1, y - 1, 2, Math.PI * 1.1, Math.PI * 1.7);
        ctx.stroke();
      }
    }
  }, { repeat: [5, 5] });
}

export function clothMap() {
  return tex('cloth', 64, 64, (ctx, w, h) => {
    const r = rng(5);
    ctx.fillStyle = '#d6d6d6';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const weave = (x + y) % 2 ? 0.94 : 1.0;
        const v = Math.round(214 * weave * (0.93 + r() * 0.1));
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, { repeat: [3, 3] });
}

export function leatherMap() {
  return tex('leather', 64, 64, (ctx, w, h) => {
    const r = rng(9);
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(0,0,0,${r() * 0.12})`;
      ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
    }
  }, { repeat: [2, 2] });
}

export function woodMap() {
  return tex('wood', 32, 128, (ctx, w, h) => {
    const r = rng(3);
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.15})`;
      ctx.fillRect(x, 0, 1, h);
    }
  });
}

function weave(ctx, base, w, h, seed) {
  const r = rng(seed);
  const c = new THREE.Color(base);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const f = ((x + y) % 2 ? 0.93 : 1) * (0.9 + r() * 0.12) * (1 - (y / h) * 0.12);
      ctx.fillStyle = `rgb(${Math.round(c.r * 255 * f)},${Math.round(c.g * 255 * f)},${Math.round(c.b * 255 * f)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// Surcoat bodice wrapped round the chest: charge on the front (u = 0.5) and the back.
export function surcoatTex(look) {
  return tex(`surcoat|${look.tabard}|${look.charge}|${look.trim}`, 128, 64, (ctx, w, h) => {
    weave(ctx, look.tabard, w, h, 21);
    ctx.fillStyle = look.trim;
    ctx.fillRect(0, h - 4, w, 4);
    ctx.fillRect(0, 0, w, 2);
    if (look.charge) {
      drawCharge(ctx, look.charge, w * 0.5, h * 0.48, 44, look.chargeColor || PALETTE.goldCss, 'rgba(0,0,0,0.5)');
      drawCharge(ctx, look.charge, 0, h * 0.48, 34, look.chargeColor || PALETTE.goldCss, null);
      drawCharge(ctx, look.charge, w, h * 0.48, 34, look.chargeColor || PALETTE.goldCss, null);
    }
  });
}

// Hanging cloth (cape, skirt panels): optional charge high on the outside face.
export function drapeTex(color, trim, charge, chargeColor, tag, leaf = false) {
  return tex(`drape|${color}|${trim}|${charge}|${tag}|${leaf}`, 64, 128, (ctx, w, h) => {
    if (leaf) {
      const r = rng(77);
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const y = r() * h;
        const x = r() * w;
        // ragged hem: fewer leaves near the bottom
        if (y > h * 0.85 && r() > (h - y) / (h * 0.15)) continue;
        const g = ['#2f6b2a', '#3f8a35', '#557a2a', '#2a5226', '#6a9a3a', '#4a6a24'][Math.floor(r() * 6)];
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, 2 + r() * 3, 4 + r() * 4, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    weave(ctx, color, w, h, tag.length * 13);
    // soft vertical folds
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = `rgba(0,0,0,${(Math.sin(x * 0.35) * 0.5 + 0.5) * 0.12})`;
      ctx.fillRect(x, 0, 1, h);
    }
    if (trim) {
      ctx.fillStyle = trim;
      ctx.fillRect(0, h - 5, w, 5);
      ctx.fillRect(0, 0, 2, h);
      ctx.fillRect(w - 2, 0, 2, h);
    }
    if (charge) drawCharge(ctx, charge, w / 2, h * 0.28, 52, chargeColor || PALETTE.goldCss, 'rgba(0,0,0,0.45)');
  });
}

export function shieldTex(field, charge, chargeColor, round) {
  return tex(`shield|${field}|${charge}|${round}`, 128, 128, (ctx, w, h) => {
    weave(ctx, field, w, h, 31);
    const r = rng(41);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(30,20,10,${r() * 0.25})`;
      ctx.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 2);
    }
    if (charge) drawCharge(ctx, charge, w / 2, h * (round ? 0.5 : 0.44), 92, chargeColor || PALETTE.goldCss, 'rgba(0,0,0,0.55)');
  });
}

// Fitted heraldic coat (jupon): quilted, charge on the front (u = 0.5) and back.
export function juponTex(look) {
  return tex(`jupon|${look.tabard}|${look.charge}|${look.trim}`, 128, 64, (ctx, w, h) => {
    weave(ctx, look.tabard, w, h, 23);
    for (let y = 6; y < h; y += 7) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(0, y, w, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, y + 1, w, 1);
    }
    ctx.fillStyle = look.trim;
    ctx.fillRect(0, 0, w, 2);
    if (look.charge) {
      drawCharge(ctx, look.charge, w * 0.5, h * 0.5, 40, look.chargeColor || PALETTE.goldCss, 'rgba(0,0,0,0.5)');
      drawCharge(ctx, look.charge, 0, h * 0.5, 34, look.chargeColor || PALETTE.goldCss, null);
      drawCharge(ctx, look.charge, w, h * 0.5, 34, look.chargeColor || PALETTE.goldCss, null);
    }
  });
}

// Jupon skirt with a dagged (scalloped) hem, cut out with alpha.
export function skirtTex(look) {
  return tex(`skirt|${look.tabard}|${look.trim}`, 128, 32, (ctx, w, h) => {
    weave(ctx, look.tabard, w, h, 29);
    for (let y = 5; y < h; y += 7) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(0, y, w, 1);
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (let x = 0; x < w; x += 8) {
      ctx.beginPath();
      ctx.arc(x + 4, h + 1, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = look.trim;
    for (let x = 0; x < w; x += 8) {
      ctx.beginPath();
      ctx.arc(x + 4, h + 1, 5.4, Math.PI * 1.15, Math.PI * 1.85);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = look.trim;
      ctx.stroke();
    }
  });
}

// Per-figure materials. Most parts share three sheets (metal, matte, mail) and
// carry their colour in vertex colours, so a knight costs few draw calls.
export function figureMaterials(look) {
  const steel = steelMap();
  const std = (opts) => new THREE.MeshStandardMaterial({ flatShading: true, ...opts });
  return {
    metal: std({ vertexColors: true, map: steel, bumpMap: steel, bumpScale: 0.5, metalness: 0.85, roughness: 0.34, envMapIntensity: 1.0 }),
    blade: std({ vertexColors: true, map: steel, metalness: 0.9, roughness: 0.22, envMapIntensity: 1.1 }),
    matte: std({ vertexColors: true, map: clothMap(), metalness: 0, roughness: 0.85, envMapIntensity: 0.25 }),
    mail: std({ color: look.mail || '#9aa0a8', map: mailMap(), bumpMap: mailMap(), bumpScale: 1.2, metalness: 0.75, roughness: 0.45, envMapIntensity: 0.7 }),
    jupon: std({ map: juponTex(look), roughness: 0.95, envMapIntensity: 0.25 }),
    skirt: std({ map: skirtTex(look), roughness: 0.95, envMapIntensity: 0.25, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
  };
}
