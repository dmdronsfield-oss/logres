import { VIEW, PALETTE } from '../config.js';
import { canvasTex, ink, fillInk, star } from './Tex.js';

// Layered manuscript-style scenes drawn once per enemy into a texture.
// Width includes a margin either side so the world can slide on a dodge.

export const BG_MARGIN = 180;

function sky(ctx, w, h, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // parchment speckle
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(90,60,30,${Math.random() * 0.07})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
}

function hills(ctx, w, y, amp, color, seed = 1, lw = 3) {
  ctx.beginPath();
  ctx.moveTo(0, VIEW.H + 10);
  ctx.lineTo(0, y);
  for (let x = 0; x <= w + 40; x += 40) {
    const yy = y + Math.sin(x / 140 + seed) * amp + Math.sin(x / 57 + seed * 2) * amp * 0.3;
    ctx.lineTo(x, yy);
  }
  ctx.lineTo(w, VIEW.H + 10);
  ctx.closePath();
  fillInk(ctx, color, lw);
}

function tree(ctx, x, y, s, crown, trunk = '#5a3a20') {
  ctx.beginPath();
  ctx.rect(x - 5 * s, y - 40 * s, 10 * s, 42 * s);
  fillInk(ctx, trunk, 2);
  ctx.beginPath();
  ctx.ellipse(x, y - 70 * s, 34 * s, 44 * s, 0, 0, Math.PI * 2);
  fillInk(ctx, crown, 2.5);
  // stylised leaf pattern
  ctx.fillStyle = 'rgba(255,240,190,0.35)';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(x + Math.cos(i * 1.7) * 18 * s, y - 70 * s + Math.sin(i * 2.3) * 24 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pine(ctx, x, y, s, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - 120 * s);
  ctx.lineTo(x + 34 * s, y - 20 * s);
  ctx.lineTo(x - 34 * s, y - 20 * s);
  ctx.closePath();
  fillInk(ctx, color, 2);
  ctx.beginPath();
  ctx.rect(x - 4 * s, y - 22 * s, 8 * s, 22 * s);
  fillInk(ctx, '#4a2f1a', 2);
}

function ground(ctx, w, h, y, color, stripe) {
  ctx.beginPath();
  ctx.rect(0, y, w, h - y);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ink(ctx, 3);
  ctx.strokeStyle = stripe;
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const yy = y + 12 + i * i * 1.6;
    if (yy > h) break;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(w, yy);
    ctx.stroke();
  }
}

function sun(ctx, x, y, r) {
  star(ctx, x, y, 16, r * 1.5, r * 1.05);
  ctx.fillStyle = PALETTE.goldCss;
  ctx.fill();
  ink(ctx, 2);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  fillInk(ctx, '#f6dc8a', 2);
}

function arch(ctx, x, y, w, h, fill) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - h + w / 2);
  ctx.arc(x, y - h + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  fillInk(ctx, fill, 3);
}

function banner(ctx, x, y, w, h, field, charge) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h - 22);
  ctx.lineTo(x - w / 2, y + h);
  ctx.closePath();
  fillInk(ctx, field, 2.5);
  ctx.fillStyle = PALETTE.goldCss;
  if (charge === 'star') {
    star(ctx, x, y + h * 0.4, 5, w * 0.28, w * 0.12);
    ctx.fill();
  } else {
    ctx.fillRect(x - 4, y + 14, 8, h - 50);
    ctx.fillRect(x - w * 0.3, y + h * 0.3, w * 0.6, 8);
  }
}

function tent(ctx, x, y, s, a, b) {
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y - 110 * s);
    ctx.lineTo(x - 60 * s + i * 20 * s, y);
    ctx.lineTo(x - 40 * s + i * 20 * s, y);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(x, y - 110 * s);
  ctx.lineTo(x + 60 * s, y);
  ctx.lineTo(x - 60 * s, y);
  ctx.closePath();
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(x, y - 110 * s);
  ctx.lineTo(x, y - 140 * s);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x, y - 140 * s);
  ctx.lineTo(x + 26 * s, y - 132 * s);
  ctx.lineTo(x, y - 124 * s);
  ctx.closePath();
  fillInk(ctx, a, 1.5);
}

const SCENES = {
  forest(ctx, w, h) {
    sky(ctx, w, h, '#f4e6c6', '#e6cf9c');
    sun(ctx, w * 0.78, 110, 30);
    hills(ctx, w, 300, 18, '#9fb07a', 1);
    for (let x = 30; x < w; x += 70) tree(ctx, x, 320 + Math.sin(x) * 8, 0.7, '#6f8f4a');
    hills(ctx, w, 360, 12, '#7c9a55', 3);
    for (let x = 0; x < w; x += 110) tree(ctx, x + 40, 380 + Math.cos(x) * 6, 1.05, '#4f7a3a');
    ground(ctx, w, h, 400, '#b9a36a', 'rgba(90,70,30,0.25)');
  },
  hall(ctx, w, h) {
    sky(ctx, w, h, '#d9c296', '#c4a978');
    // stone wall
    ctx.fillStyle = '#b6a283';
    ctx.fillRect(0, 60, w, 360);
    ctx.strokeStyle = 'rgba(42,29,20,0.25)';
    ctx.lineWidth = 2;
    for (let y = 60; y < 420; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      for (let x = (y / 30) % 2 ? 0 : 30; x < w; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 30);
        ctx.stroke();
      }
    }
    for (let x = 90; x < w; x += 220) {
      arch(ctx, x, 380, 120, 280, '#2b2a33');
      ctx.fillStyle = 'rgba(43,74,155,0.55)';
      ctx.fillRect(x - 40, 160, 80, 120);
      banner(ctx, x + 110, 80, 60, 150, x % 440 < 220 ? PALETTE.vermilionCss : PALETTE.lapisCss, 'star');
    }
    ground(ctx, w, h, 410, '#8f7a5a', 'rgba(42,29,20,0.25)');
    // checkered floor hint
    for (let x = 0; x < w; x += 60) {
      ctx.fillStyle = 'rgba(42,29,20,0.08)';
      ctx.fillRect(x, 420, 30, 120);
    }
  },
  road(ctx, w, h) {
    sky(ctx, w, h, '#f0c99a', '#c98e6a');
    sun(ctx, w * 0.25, 190, 44);
    hills(ctx, w, 290, 30, '#8a7a9a', 2);
    hills(ctx, w, 340, 16, '#6f6a50', 4);
    for (let x = 10; x < w; x += 50) pine(ctx, x, 360 + Math.sin(x * 3) * 10, 0.8 + Math.sin(x) * 0.15, '#3d5a35');
    ground(ctx, w, h, 395, '#a88f62', 'rgba(70,50,20,0.25)');
    // the road
    ctx.beginPath();
    ctx.moveTo(w / 2 - 50, 395);
    ctx.lineTo(w / 2 + 50, 395);
    ctx.lineTo(w / 2 + 360, h);
    ctx.lineTo(w / 2 - 360, h);
    ctx.closePath();
    fillInk(ctx, '#c9b07a', 2);
  },
  field(ctx, w, h) {
    sky(ctx, w, h, '#f4ead2', '#dfc89a');
    sun(ctx, w * 0.82, 90, 26);
    hills(ctx, w, 320, 10, '#a3b06a', 5);
    for (let x = 60; x < w; x += 230) tent(ctx, x, 360, 0.9, PALETTE.vermilionCss, '#f1e3c4');
    for (let x = 175; x < w; x += 230) tent(ctx, x, 370, 0.7, PALETTE.lapisCss, '#f1e3c4');
    // lists fence
    ctx.strokeStyle = PALETTE.inkCss;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 384);
    ctx.lineTo(w, 384);
    ctx.stroke();
    for (let x = 0; x < w; x += 46) {
      ctx.beginPath();
      ctx.rect(x, 372, 8, 30);
      fillInk(ctx, x % 92 ? PALETTE.vermilionCss : '#f1e3c4', 2);
    }
    ground(ctx, w, h, 402, '#9aa85e', 'rgba(60,70,20,0.25)');
  },
  chapel(ctx, w, h) {
    sky(ctx, w, h, '#dfe3e6', '#b9c3c7');
    // falling snow
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 160; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * 400, 1 + Math.random() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    hills(ctx, w, 280, 26, '#eef1f2', 7);
    for (let x = 20; x < w; x += 60) pine(ctx, x, 330 + Math.sin(x) * 10, 0.75, '#2f5a3a');
    // the green chapel: a grassy mound with a dark door
    const cx = w / 2;
    ctx.beginPath();
    ctx.ellipse(cx, 370, 260, 150, 0, Math.PI, 0);
    fillInk(ctx, '#4f8a45', 3);
    ctx.beginPath();
    ctx.ellipse(cx, 370, 260, 150, 0, Math.PI, 0);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let x = cx - 260; x < cx + 260; x += 26) {
      ctx.beginPath();
      ctx.arc(x, 226 + Math.abs(x - cx) * 0.35, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    arch(ctx, cx, 372, 90, 130, '#1d2a1d');
    ground(ctx, w, h, 370, '#e9eef0', 'rgba(80,100,110,0.25)');
  },
  chapelInterior(ctx, w, h) {
    sky(ctx, w, h, '#3a3040', '#1d1820');
    for (let x = w / 2 - 300; x <= w / 2 + 300; x += 200) {
      arch(ctx, x, 360, 120, 300, '#2a2230');
      const g = ctx.createLinearGradient(0, 100, 0, 300);
      g.addColorStop(0, 'rgba(43,74,155,0.9)');
      g.addColorStop(1, 'rgba(200,54,31,0.8)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 40, 120, 80, 160);
      ctx.strokeStyle = PALETTE.inkCss;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 40, 120, 80, 160);
      ctx.beginPath();
      ctx.moveTo(x, 120);
      ctx.lineTo(x, 280);
      ctx.moveTo(x - 40, 200);
      ctx.lineTo(x + 40, 200);
      ctx.stroke();
    }
    ground(ctx, w, h, 400, '#3b3236', 'rgba(0,0,0,0.25)');
  },
};

// Paint a scene straight onto a 2D canvas context (used as the 3D horizon).
export function paintScene(ctx, kind, w, h) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  (SCENES[kind] || SCENES.forest)(ctx, w, h);
}

export function backgroundKey(scene, kind) {
  const w = VIEW.W + BG_MARGIN * 2;
  const h = VIEW.H;
  return canvasTex(scene, `bg_${kind}_${VIEW.W}`, w, h, (ctx) => (SCENES[kind] || SCENES.forest)(ctx, w, h));
}

