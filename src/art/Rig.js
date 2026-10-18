import { VIEW, PALETTE } from '../config.js';
import { canvasTex, img, ink, fillInk, crown, star } from './Tex.js';

// Enemy figures are cut-out rigs: each limb is its own display object inside
// nested containers, so poses are tweened by rotating containers.
//
// Hierarchy:  root (hip) -> legs, body -> torso, head, armL -> shield, armR -> weapon

const ARM_LEN = 112;
const SHOULDER_X = 60;
const SHOULDER_Y = -122;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt;
  let g = ((n >> 8) & 255) + amt;
  let b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function drawLegs(ctx, p) {
  // Two legs with boots, drawn into a 150x190 box, hip at top centre (75, 10).
  [[-1, 46], [1, 104]].forEach(([s, x]) => {
    ctx.beginPath();
    ctx.moveTo(x - 20, 8);
    ctx.lineTo(x + 20, 8);
    ctx.lineTo(x + 16 + s * 6, 160);
    ctx.lineTo(x - 14 + s * 6, 160);
    ctx.closePath();
    fillInk(ctx, p.legs);
    ctx.beginPath();
    ctx.moveTo(x - 18 + s * 6, 152);
    ctx.lineTo(x + 18 + s * 6, 152);
    ctx.lineTo(x + 22 + s * 14, 182);
    ctx.lineTo(x - 18 + s * 4, 182);
    ctx.closePath();
    fillInk(ctx, p.boots);
  });
}

function drawTorso(ctx, p, w, h) {
  // Surcoat/tunic from shoulders (top) flaring to the hip skirt (bottom).
  const cx = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 62, 18);
  ctx.quadraticCurveTo(cx, 4, cx + 62, 18);
  ctx.lineTo(cx + 54, 110);
  ctx.lineTo(cx + 72, h - 8);
  ctx.lineTo(cx - 72, h - 8);
  ctx.lineTo(cx - 54, 110);
  ctx.closePath();
  fillInk(ctx, p.body);
  // belt
  ctx.beginPath();
  ctx.rect(cx - 56, 112, 112, 14);
  fillInk(ctx, p.belt, 2);
  ctx.beginPath();
  ctx.rect(cx - 8, 110, 16, 18);
  fillInk(ctx, PALETTE.goldCss, 2);
  // hem trim
  ctx.beginPath();
  ctx.moveTo(cx - 70, h - 18);
  ctx.lineTo(cx + 70, h - 18);
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 5;
  ctx.stroke();
  // heraldic device on the chest
  ctx.save();
  ctx.translate(cx, 64);
  drawDevice(ctx, p);
  ctx.restore();
}

export function drawDevice(ctx, p) {
  ctx.fillStyle = p.trim;
  ctx.strokeStyle = PALETTE.inkCss;
  ctx.lineWidth = 2;
  switch (p.device) {
    case 'cross':
      ctx.fillRect(-6, -30, 12, 60);
      ctx.fillRect(-26, -10, 52, 12);
      break;
    case 'lion':
      star(ctx, 0, 0, 5, 22, 9);
      ctx.fill();
      ctx.stroke();
      break;
    case 'chevron':
      ctx.beginPath();
      ctx.moveTo(-34, 18);
      ctx.lineTo(0, -16);
      ctx.lineTo(34, 18);
      ctx.lineTo(34, 30);
      ctx.lineTo(0, -4);
      ctx.lineTo(-34, 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'holly':
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(-16 + i * 16, 0, 7, 16, (i - 1) * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = p.trim;
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 18, 5, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.vermilionCss;
      ctx.fill();
      ctx.stroke();
      break;
    case 'crowns':
      [[-18, -14], [18, -14], [0, 16]].forEach(([x, y]) => {
        crown(ctx, x, y, 12);
        ctx.fillStyle = p.trim;
        ctx.fill();
        ctx.stroke();
      });
      break;
    case 'studs':
      for (let y = -24; y <= 24; y += 16) {
        for (let x = -30; x <= 30; x += 15) {
          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    default:
      break;
  }
}

function drawHead(ctx, p, w) {
  const cx = w / 2;
  const cy = 52;
  if (p.helm === 'greathelm') {
    ctx.beginPath();
    ctx.moveTo(cx - 34, 92);
    ctx.lineTo(cx - 36, 34);
    ctx.quadraticCurveTo(cx, 6, cx + 36, 34);
    ctx.lineTo(cx + 34, 92);
    ctx.closePath();
    fillInk(ctx, p.helmColor);
    // eye slit and breaths
    ctx.fillStyle = PALETTE.inkCss;
    ctx.fillRect(cx - 28, 50, 56, 7);
    ctx.fillRect(cx - 2, 50, 4, 40);
    ctx.beginPath();
    ctx.moveTo(cx, 18);
    ctx.lineTo(cx, 50);
    ctx.strokeStyle = p.trim;
    ctx.lineWidth = 4;
    ctx.stroke();
    if (p.crest) {
      ctx.beginPath();
      ctx.moveTo(cx - 8, 20);
      ctx.quadraticCurveTo(cx - 30, -10, cx + 26, -2);
      ctx.quadraticCurveTo(cx + 4, 6, cx + 8, 20);
      ctx.closePath();
      fillInk(ctx, p.crest, 2);
    }
    return;
  }
  if (p.helm === 'wild') {
    // great green mane, behind the face
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * 0.85 + (i / 10) * Math.PI * 1.3;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * 34, cy + Math.sin(a) * 38, 13, 22, a + Math.PI / 2, 0, Math.PI * 2);
      fillInk(ctx, p.hair, 2);
    }
  }
  // Bare face
  ctx.beginPath();
  ctx.ellipse(cx, cy, 30, 36, 0, 0, Math.PI * 2);
  fillInk(ctx, p.skin);
  // eyes
  ctx.fillStyle = PALETTE.inkCss;
  ctx.beginPath();
  ctx.arc(cx - 11, cy - 4, 3, 0, Math.PI * 2);
  ctx.arc(cx + 11, cy - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 13);
  ctx.lineTo(cx - 5, cy - 9);
  ctx.moveTo(cx + 18, cy - 13);
  ctx.lineTo(cx + 5, cy - 9);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  if (p.beard) {
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy + 4);
    ctx.quadraticCurveTo(cx - 24, cy + 52, cx, cy + 58);
    ctx.quadraticCurveTo(cx + 24, cy + 52, cx + 28, cy + 4);
    ctx.quadraticCurveTo(cx, cy + 22, cx - 28, cy + 4);
    fillInk(ctx, p.beard, 2.5);
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 18);
    ctx.lineTo(cx + 8, cy + 18);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (p.helm === 'spangen') {
    ctx.beginPath();
    ctx.moveTo(cx - 33, cy - 8);
    ctx.quadraticCurveTo(cx - 32, cy - 50, cx, cy - 54);
    ctx.quadraticCurveTo(cx + 32, cy - 50, cx + 33, cy - 8);
    ctx.closePath();
    fillInk(ctx, p.helmColor);
    ctx.beginPath();
    ctx.rect(cx - 4, cy - 10, 8, 26);
    fillInk(ctx, p.helmColor, 2);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 54);
    ctx.lineTo(cx, cy - 10);
    ctx.moveTo(cx - 33, cy - 10);
    ctx.lineTo(cx + 33, cy - 10);
    ctx.strokeStyle = PALETTE.goldCss;
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (p.helm === 'hood') {
    ctx.beginPath();
    ctx.moveTo(cx - 40, cy + 30);
    ctx.quadraticCurveTo(cx - 44, cy - 52, cx, cy - 56);
    ctx.quadraticCurveTo(cx + 44, cy - 52, cx + 40, cy + 30);
    ctx.quadraticCurveTo(cx + 30, cy - 30, cx, cy - 32);
    ctx.quadraticCurveTo(cx - 30, cy - 30, cx - 40, cy + 30);
    fillInk(ctx, p.helmColor);
  }
}

function drawArm(ctx, p, w) {
  // Sleeve pointing down from the shoulder at (w/2, 10), gauntlet at the end.
  const cx = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 17, 6);
  ctx.lineTo(cx + 17, 6);
  ctx.lineTo(cx + 13, ARM_LEN - 10);
  ctx.lineTo(cx - 13, ARM_LEN - 10);
  ctx.closePath();
  fillInk(ctx, p.sleeve);
  ctx.beginPath();
  ctx.arc(cx, ARM_LEN, 15, 0, Math.PI * 2);
  fillInk(ctx, p.hand);
}

function drawWeapon(ctx, kind, p, w, h) {
  // Drawn pointing down from the grip at (w/2, 8).
  const cx = w / 2;
  if (kind === 'axe' || kind === 'greataxe') {
    const big = kind === 'greataxe';
    const haft = big ? h - 12 : h - 10;
    ctx.beginPath();
    ctx.rect(cx - (big ? 6 : 5), 0, big ? 12 : 10, haft);
    fillInk(ctx, '#6b4423', 2.5);
    const hy = haft - (big ? 30 : 20);
    const hs = big ? 70 : 40;
    ctx.beginPath();
    ctx.moveTo(cx + 4, hy - hs * 0.35);
    ctx.quadraticCurveTo(cx + hs * 1.1, hy - hs * 0.7, cx + hs, hy);
    ctx.quadraticCurveTo(cx + hs * 1.1, hy + hs * 0.7, cx + 4, hy + hs * 0.35);
    ctx.closePath();
    fillInk(ctx, p.blade);
    ctx.beginPath();
    ctx.moveTo(cx + hs * 0.95, hy - hs * 0.55);
    ctx.quadraticCurveTo(cx + hs * 1.08, hy, cx + hs * 0.95, hy + hs * 0.55);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }
  const bladeW = kind === 'falchion' ? 15 : 12;
  // grip and pommel
  ctx.beginPath();
  ctx.rect(cx - 5, 0, 10, 24);
  fillInk(ctx, '#5a3a20', 2);
  ctx.beginPath();
  ctx.rect(cx - 24, 22, 48, 9);
  fillInk(ctx, p.hilt || PALETTE.goldCss, 2);
  // blade
  ctx.beginPath();
  ctx.moveTo(cx - bladeW / 2, 31);
  ctx.lineTo(cx + bladeW / 2, 31);
  if (kind === 'falchion') {
    ctx.lineTo(cx + bladeW, h - 30);
    ctx.quadraticCurveTo(cx + bladeW, h - 4, cx - bladeW / 2, h - 4);
  } else {
    ctx.lineTo(cx + bladeW / 2, h - 22);
    ctx.lineTo(cx, h - 4);
    ctx.lineTo(cx - bladeW / 2, h - 22);
  }
  ctx.closePath();
  fillInk(ctx, p.blade, 2.5);
  ctx.beginPath();
  ctx.moveTo(cx, 34);
  ctx.lineTo(cx, h - 30);
  ctx.strokeStyle = 'rgba(42,29,20,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawShieldShape(ctx, kind, cx, cy, s, field, charge, rim = PALETTE.goldCss) {
  ctx.beginPath();
  if (kind === 'round') {
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
  } else {
    ctx.moveTo(cx - s, cy - s * 0.9);
    ctx.lineTo(cx + s, cy - s * 0.9);
    ctx.lineTo(cx + s, cy);
    ctx.quadraticCurveTo(cx + s * 0.9, cy + s * 0.9, cx, cy + s * 1.3);
    ctx.quadraticCurveTo(cx - s * 0.9, cy + s * 0.9, cx - s, cy);
    ctx.closePath();
  }
  ctx.fillStyle = field;
  ctx.fill();
  ctx.lineWidth = s * 0.12;
  ctx.strokeStyle = rim;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE.inkCss;
  ctx.stroke();
  ctx.save();
  ctx.fillStyle = PALETTE.goldCss;
  ctx.strokeStyle = PALETTE.inkCss;
  ctx.lineWidth = 2;
  if (charge === 'crowns') {
    crown(ctx, cx - s * 0.42, cy - s * 0.35, s * 0.22); ctx.fill(); ctx.stroke();
    crown(ctx, cx + s * 0.42, cy - s * 0.35, s * 0.22); ctx.fill(); ctx.stroke();
    crown(ctx, cx, cy + s * 0.35, s * 0.22); ctx.fill(); ctx.stroke();
  } else if (charge === 'cross') {
    ctx.fillStyle = '#f3f0e6';
    ctx.fillRect(cx - s * 0.12, cy - s * 0.8, s * 0.24, s * 1.8);
    ctx.fillRect(cx - s * 0.75, cy - s * 0.25, s * 1.5, s * 0.24);
  } else if (charge === 'boss') {
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * s * 0.7, cy + Math.sin(a) * s * 0.7, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (charge === 'bend') {
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s * 0.6);
    ctx.lineTo(cx - s * 0.6, cy - s * 0.9);
    ctx.lineTo(cx + s, cy + s * 0.4);
    ctx.lineTo(cx + s * 0.5, cy + s * 0.85);
    ctx.closePath();
    ctx.fillStyle = '#d8d8d8';
    ctx.fill();
  }
  ctx.restore();
}

function drawHolly(ctx, w, h) {
  const cx = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h - 30);
  ctx.strokeStyle = '#5a3a20';
  ctx.lineWidth = 5;
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const y = 20 + i * 14;
    const s = i % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.ellipse(cx + s * 14, y, 7, 15, s * 0.9, 0, Math.PI * 2);
    fillInk(ctx, '#2f6b2a', 2);
  }
  ctx.fillStyle = PALETTE.vermilionCss;
  [[-5, 30], [6, 52], [-3, 76]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(cx + x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function weaponLength(kind) {
  return { axe: 110, greataxe: 210, sword: 160, falchion: 130 }[kind] || 150;
}

// Build textures for an enemy (once per enemy id) and return a rig object.
export function buildEnemyRig(scene, def) {
  const p = def.palette;
  const id = def.id;
  const wl = weaponLength(def.weapon);
  canvasTex(scene, `${id}_legs`, 150, 190, (ctx) => drawLegs(ctx, p));
  canvasTex(scene, `${id}_torso`, 160, 190, (ctx, w, h) => drawTorso(ctx, p, w, h));
  canvasTex(scene, `${id}_head`, 130, 130, (ctx) => { ctx.translate(15, 8); drawHead(ctx, p, 100); });
  canvasTex(scene, `${id}_arm`, 44, ARM_LEN + 20, (ctx, w) => drawArm(ctx, p, w));
  canvasTex(scene, `${id}_weapon`, def.weapon === 'greataxe' ? 170 : 110, wl, (ctx, w, h) => drawWeapon(ctx, def.weapon, p, w, h));
  if (def.offhand === 'holly') canvasTex(scene, `${id}_off`, 50, 120, (ctx, w, h) => drawHolly(ctx, w, h));
  else if (def.offhand) {
    canvasTex(scene, `${id}_off`, 130, 150, (ctx) => drawShieldShape(ctx, def.offhand, 65, 62, def.offhand === 'buckler' ? 34 : 54, p.shield, p.shieldCharge));
  }

  const root = scene.add.container(0, 0);
  const legs = img(scene, 0, -10, `${id}_legs`, 0.5, 0);
  const body = scene.add.container(0, 0);
  const torso = img(scene, 0, 30, `${id}_torso`, 0.5, 1);
  const head = scene.add.container(0, -150);
  head.add(img(scene, 0, 0, `${id}_head`, 0.5, 0.63));

  const armL = scene.add.container(SHOULDER_X, SHOULDER_Y);   // enemy's left = screen right
  armL.add(img(scene, 0, -10, `${id}_arm`, 0.5, 0));
  if (def.offhand) {
    const off = img(scene, 0, ARM_LEN, `${id}_off`, 0.5, def.offhand === 'holly' ? 0.1 : 0.42);
    armL.add(off);
  }

  const armR = scene.add.container(-SHOULDER_X, SHOULDER_Y);  // weapon arm = screen left
  const weapon = scene.add.container(0, ARM_LEN);
  weapon.add(img(scene, 0, -8, `${id}_weapon`, 0.5, 0));
  armR.add(img(scene, 0, -10, `${id}_arm`, 0.5, 0));
  armR.add(weapon);

  body.add([torso, head, armR, armL]);
  // Keep the weapon arm in front of the body.
  root.add([legs, body]);

  const weaponImg = weapon.list[0];
  const setWeaponTint = (c) => (c === null ? weaponImg.clearTint() : weaponImg.setTint(c));
  return { root, body, head, armL, armR, weapon, weaponLen: wl - 16, setWeaponTint };
}

// ---------- Player first-person rig ----------

export function buildPlayerRig(scene, sword, shield, leftHanded) {
  canvasTex(scene, `pl_sword_${sword.id}`, 70, 330, (ctx, w, h) => {
    const cx = w / 2;
    // blade pointing UP from hilt at bottom
    ctx.beginPath();
    ctx.moveTo(cx - 9, h - 70);
    ctx.lineTo(cx - 9, 34);
    ctx.lineTo(cx, 6);
    ctx.lineTo(cx + 9, 34);
    ctx.lineTo(cx + 9, h - 70);
    ctx.closePath();
    const g = ctx.createLinearGradient(cx - 9, 0, cx + 9, 0);
    g.addColorStop(0, shade(sword.color, -40));
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(1, shade(sword.color, -20));
    ctx.fillStyle = g;
    ctx.fill();
    ink(ctx, 3);
    ctx.beginPath();
    ctx.moveTo(cx, 30);
    ctx.lineTo(cx, h - 74);
    ctx.strokeStyle = 'rgba(42,29,20,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // crossguard
    ctx.beginPath();
    ctx.rect(cx - 32, h - 72, 64, 12);
    fillInk(ctx, sword.hilt, 2.5);
    // grip
    ctx.beginPath();
    ctx.rect(cx - 7, h - 60, 14, 44);
    fillInk(ctx, '#4a2f1a', 2);
    ctx.beginPath();
    ctx.arc(cx, h - 12, 10, 0, Math.PI * 2);
    fillInk(ctx, sword.hilt, 2.5);
  });
  canvasTex(scene, 'pl_arm', 120, 260, (ctx, w, h) => {
    // mailed forearm rising from bottom to a gauntlet at top
    const cx = w / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 44, h);
    ctx.lineTo(cx - 28, 60);
    ctx.lineTo(cx + 28, 60);
    ctx.lineTo(cx + 44, h);
    ctx.closePath();
    fillInk(ctx, '#9aa1ad');
    ctx.strokeStyle = 'rgba(42,29,20,0.35)';
    ctx.lineWidth = 1.5;
    for (let y = 72; y < h; y += 12) {
      ctx.beginPath();
      ctx.moveTo(cx - 36, y);
      ctx.lineTo(cx + 36, y);
      ctx.stroke();
    }
    // lapis sleeve cuff
    ctx.beginPath();
    ctx.rect(cx - 40, 150, 80, 26);
    fillInk(ctx, PALETTE.lapisCss, 2.5);
    ctx.beginPath();
    ctx.rect(cx - 40, 150, 80, 5);
    ctx.fillStyle = PALETTE.goldCss;
    ctx.fill();
    // gauntlet fist
    ctx.beginPath();
    ctx.ellipse(cx, 48, 34, 30, 0, 0, Math.PI * 2);
    fillInk(ctx, '#b7bcc6');
    ctx.beginPath();
    ctx.moveTo(cx - 26, 40);
    ctx.lineTo(cx + 26, 40);
    ctx.moveTo(cx - 26, 54);
    ctx.lineTo(cx + 26, 54);
    ctx.strokeStyle = PALETTE.inkCss;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  canvasTex(scene, `pl_shield_${shield.id}`, 260, 300, (ctx) => {
    drawShieldShape(ctx, shield.id === 'targe' ? 'round' : 'heater', 130, 130, 112, shield.field, shield.charge);
  });

  const W = VIEW.W;
  const H = VIEW.H;
  const side = leftHanded ? -1 : 1;
  const swordHome = { x: W / 2 + side * W * 0.34, y: H + 30, angle: side * 10 };
  const shieldHome = { x: W / 2 - side * W * 0.3, y: H + 45, angle: side * 8 };

  const swordArm = scene.add.container(swordHome.x, swordHome.y);
  swordArm.add(img(scene, 0, 0, 'pl_arm', 0.5, 0.95));
  const swordImg = img(scene, 0, -205, `pl_sword_${sword.id}`, 0.5, 0.9);
  swordArm.add(swordImg);
  swordArm.setAngle(swordHome.angle);

  const shieldC = scene.add.container(shieldHome.x, shieldHome.y);
  shieldC.add(img(scene, 0, 0, `pl_shield_${shield.id}`, 0.5, 0.45));
  shieldC.setAngle(shieldHome.angle);

  return { swordArm, shield: shieldC, swordHome, shieldHome, side };
}
