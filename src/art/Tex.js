import { VIEW, FONT, PALETTE } from '../config.js';

// Draw a texture with the Canvas 2D API at render resolution so it stays crisp.
// `draw(ctx, w, h)` works in logical units.
export function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const R = VIEW.RES;
  const tex = scene.textures.createCanvas(key, Math.ceil(w * R), Math.ceil(h * R));
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(R, R);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, w, h);
  ctx.restore();
  tex.refresh();
  return key;
}

// An image from a canvasTex texture, shown at logical size. Scale containers, not these.
export function img(scene, x, y, key, ox = 0.5, oy = 0.5) {
  return scene.add.image(x, y, key).setOrigin(ox, oy).setScale(1 / VIEW.RES);
}

export function text(scene, x, y, str, style = {}) {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: '22px',
    color: PALETTE.inkCss,
    align: 'center',
    resolution: VIEW.RES,
    ...style,
  });
  t.setOrigin(style.originX ?? 0.5, style.originY ?? 0.5);
  return t;
}

// Convert a point local to `obj` into scene coordinates, walking parent containers.
export function localToWorld(obj, x, y) {
  let px = x;
  let py = y;
  let o = obj;
  while (o) {
    px *= o.scaleX;
    py *= o.scaleY;
    const c = Math.cos(o.rotation);
    const s = Math.sin(o.rotation);
    const nx = px * c - py * s;
    const ny = px * s + py * c;
    px = nx + o.x;
    py = ny + o.y;
    o = o.parentContainer;
  }
  return { x: px, y: py };
}

// Rotation (degrees) that turns a part drawn pointing "down" to point along (vx, vy).
export function angFor(vx, vy) {
  return Phaser.Math.RadToDeg(Math.atan2(-vx, vy));
}

// Shared canvas drawing helpers.
export function ink(ctx, w = 3) {
  ctx.strokeStyle = PALETTE.inkCss;
  ctx.lineWidth = w;
  ctx.stroke();
}

export function fillInk(ctx, fill, w = 3) {
  ctx.fillStyle = fill;
  ctx.fill();
  ink(ctx, w);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function star(ctx, cx, cy, points, outer, inner, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function crown(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx - s, cy + s * 0.6);
  ctx.lineTo(cx - s, cy - s * 0.3);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.1);
  ctx.lineTo(cx, cy - s * 0.6);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.1);
  ctx.lineTo(cx + s, cy - s * 0.3);
  ctx.lineTo(cx + s, cy + s * 0.6);
  ctx.closePath();
}

// Gilded roundel used for every touch button.
export function roundel(ctx, cx, cy, r, { lit = false } = {}) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  if (lit) {
    g.addColorStop(0, '#fff6cf');
    g.addColorStop(0.5, '#f6d061');
    g.addColorStop(1, '#b3801c');
  } else {
    g.addColorStop(0, '#f7e3a1');
    g.addColorStop(0.55, '#d4a23a');
    g.addColorStop(1, '#7e5714');
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ink(ctx, 3);
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(42,29,20,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // dotted inner ring, a manuscript touch
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5), 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,248,220,0.8)';
    ctx.fill();
  }
}

// Parchment plaque used for menu buttons.
export function plaque(ctx, w, h, { fill = '#f1e3c4', border = '#d9a933' } = {}) {
  roundRect(ctx, 3, 3, w - 6, h - 6, 10);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = border;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.inkCss;
  ctx.stroke();
  roundRect(ctx, 9, 9, w - 18, h - 18, 6);
  ctx.strokeStyle = 'rgba(43,74,155,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
