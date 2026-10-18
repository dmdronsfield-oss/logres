import { PALETTE } from '../config.js';
import { canvasTex, img, text, plaque } from '../art/Tex.js';
import { Sfx } from '../audio/Sfx.js';

// Parchment plaque button for menus.
export function menuButton(scene, x, y, w, h, label, onClick, { size = 24, fill = '#f1e3c4', color = PALETTE.inkCss } = {}) {
  const key = `plaque_${w}x${h}_${fill}`;
  canvasTex(scene, key, w, h, (ctx) => plaque(ctx, w, h, { fill }));
  const bg = img(scene, 0, 0, key);
  const t = text(scene, 0, 0, label, { fontSize: `${size}px`, fontStyle: '700', color });
  const c = scene.add.container(x, y, [bg, t]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => c.setScale(0.95));
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => {
    c.setScale(1);
    Sfx.unlock();
    Sfx.click();
    onClick(c);
  });
  c.label = t;
  c.setLabel = (s) => t.setText(s);
  return c;
}

// Small round arrow button used by the gear selectors.
export function arrowButton(scene, x, y, dir, onClick) {
  const key = `arrowbtn_${dir}`;
  canvasTex(scene, key, 44, 44, (ctx) => {
    ctx.beginPath();
    ctx.arc(22, 22, 19, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.goldCss;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = PALETTE.inkCss;
    ctx.stroke();
    ctx.beginPath();
    const s = dir < 0 ? -1 : 1;
    ctx.moveTo(22 + s * 8, 22);
    ctx.lineTo(22 - s * 6, 12);
    ctx.lineTo(22 - s * 6, 32);
    ctx.closePath();
    ctx.fillStyle = PALETTE.lapisCss;
    ctx.fill();
    ctx.stroke();
  });
  const b = img(scene, x, y, key);
  b.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Circle(22 * b.width / 44, 22 * b.height / 44, 30 * b.width / 44), hitAreaCallback: Phaser.Geom.Circle.Contains });
  b.on('pointerup', () => {
    Sfx.unlock();
    Sfx.click();
    onClick();
  });
  return b;
}
