import { CONFIG, VIEW, PALETTE } from '../config.js';
import { canvasTex, img, text, roundel, ink, star, roundRect } from '../art/Tex.js';
import { drawShieldShape } from '../art/Rig.js';
import { drawCrest } from '../art/Heraldry.js';

const DEPTH = 40;

function iconArrow(ctx, cx, cy, s, dir) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(dir, 1);
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.lineTo(-s * 0.1, -s * 0.75);
  ctx.lineTo(-s * 0.1, -s * 0.3);
  ctx.lineTo(s * 0.9, -s * 0.3);
  ctx.lineTo(s * 0.9, s * 0.3);
  ctx.lineTo(-s * 0.1, s * 0.3);
  ctx.lineTo(-s * 0.1, s * 0.75);
  ctx.closePath();
  ctx.fillStyle = PALETTE.lapisCss;
  ctx.fill();
  ink(ctx, 2.5);
  ctx.restore();
}

function makeButtonTextures(scene) {
  const R = 54;
  const S = R * 2 + 4;
  canvasTex(scene, 'btn_dodgeL', S, S, (ctx) => { roundel(ctx, S / 2, S / 2, R); iconArrow(ctx, S / 2, S / 2, 24, 1); });
  canvasTex(scene, 'btn_dodgeR', S, S, (ctx) => { roundel(ctx, S / 2, S / 2, R); iconArrow(ctx, S / 2, S / 2, 24, -1); });
  canvasTex(scene, 'btn_block', S, S, (ctx) => {
    roundel(ctx, S / 2, S / 2, R);
    drawShieldShape(ctx, 'heater', S / 2, S / 2 - 6, 22, PALETTE.lapisCss, 'cross', PALETTE.goldDark);
  });
  const SR = 44;
  const SS = SR * 2 + 4;
  canvasTex(scene, 'btn_super', SS, SS, (ctx) => {
    roundel(ctx, SS / 2, SS / 2, SR);
    star(ctx, SS / 2, SS / 2, 8, 24, 11);
    ctx.fillStyle = PALETTE.vermilionCss;
    ctx.fill();
    ink(ctx, 2);
  });
  canvasTex(scene, 'btn_super_lit', SS, SS, (ctx) => {
    roundel(ctx, SS / 2, SS / 2, SR, { lit: true });
    star(ctx, SS / 2, SS / 2, 8, 28, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ink(ctx, 2);
  });
  const PR = 28;
  const PS = PR * 2 + 4;
  canvasTex(scene, 'btn_pause', PS, PS, (ctx) => {
    roundel(ctx, PS / 2, PS / 2, PR);
    ctx.fillStyle = PALETTE.inkCss;
    ctx.fillRect(PS / 2 - 9, PS / 2 - 10, 6, 20);
    ctx.fillRect(PS / 2 + 3, PS / 2 - 10, 6, 20);
  });
  canvasTex(scene, 'pip_on', 18, 18, (ctx) => {
    ctx.beginPath();
    ctx.arc(9, 9, 7, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.goldCss;
    ctx.fill();
    ink(ctx, 2);
  });
  canvasTex(scene, 'pip_off', 18, 18, (ctx) => {
    ctx.beginPath();
    ctx.arc(9, 9, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(42,29,20,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,29,20,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  // Chevron pointing right (rotated to the swipe direction): combo and riposte hints.
  canvasTex(scene, 'chev', 96, 96, (ctx) => {
    const draw = (ox, a) => {
      ctx.beginPath();
      ctx.moveTo(ox - 16, 18);
      ctx.lineTo(ox + 14, 48);
      ctx.lineTo(ox - 16, 78);
      ctx.lineTo(ox - 2, 78);
      ctx.lineTo(ox + 28, 48);
      ctx.lineTo(ox - 2, 18);
      ctx.closePath();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff3c4';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2a1d14';
      ctx.stroke();
    };
    draw(30, 0.55);
    draw(58, 1);
    ctx.globalAlpha = 1;
  });
  canvasTex(scene, 'banner', 620, 92, (ctx, w, h) => {
    roundRect(ctx, 4, 4, w - 8, h - 8, 12);
    ctx.fillStyle = 'rgba(241,227,196,0.94)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = PALETTE.goldCss;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.inkCss;
    ctx.stroke();
    ctx.fillStyle = PALETTE.vermilionCss;
    ctx.fillRect(14, 14, 8, h - 28);
    ctx.fillRect(w - 22, 14, 8, h - 28);
  });
}

export class Hud {
  // style 'tourney' = the third-person top bar: named crests, segmented health, round plaque.
  constructor(scene, { enemyName, leftHanded, bannerY = 236, style = 'classic', tourney = null }) {
    this.scene = scene;
    makeButtonTextures(scene);
    const W = VIEW.W;
    const H = VIEW.H;
    const padL = Math.max(14, VIEW.safeL + 6);
    const padR = Math.max(14, VIEW.safeR + 6);
    const padB = Math.max(0, VIEW.safeB);

    const superX = leftHanded ? W - padR - 54 : padL + 54;
    const pauseX = leftHanded ? padL + 40 : W - padR - 74;

    this.tourney = style === 'tourney';
    this.pos = {
      dodgeL: { x: padL + 66, y: H - 70 - padB, r: 54 },
      dodgeR: { x: W - padR - 66, y: H - 70 - padB, r: 54 },
      block: { x: W / 2, y: H - 92 - padB, r: 54 },
      super: { x: superX, y: 62, r: 44 },
      pause: { x: pauseX, y: 44, r: 28 },
    };
    if (this.tourney) {
      // The top of the screen belongs to the tourney bar; buttons shrink and sink
      // so the fighters' legs stay visible.
      const s = 0.82;
      this.btnScale = s;
      this.pos.dodgeL = { x: padL + 54, y: H - 52 - padB, r: 54 * s };
      this.pos.dodgeR = { x: W - padR - 54, y: H - 52 - padB, r: 54 * s };
      this.pos.block = { x: W / 2, y: H - 54 - padB, r: 54 * s };
      this.pos.super = { x: leftHanded ? W / 2 + 120 : W / 2 - 120, y: H - 46 - padB, r: 44 * s };
      this.pos.pause = { x: leftHanded ? padL + 36 : W - padR - 36, y: 118, r: 28 };
    }
    if (VIEW.portrait) {
      // Upright: a row of roundels along the bottom, the super above the left thumb.
      const s = 0.95;
      this.btnScale = s;
      this.pos.dodgeL = { x: padL + 66, y: H - 84 - padB, r: 54 * s };
      this.pos.dodgeR = { x: W - padR - 66, y: H - 84 - padB, r: 54 * s };
      this.pos.block = { x: W / 2, y: H - 96 - padB, r: 54 * s };
      this.pos.super = { x: leftHanded ? W - padR - 60 : padL + 60, y: H - 214 - padB, r: 44 * s };
      this.pos.pause = { x: leftHanded ? padL + 36 : W - padR - 36, y: 176, r: 28 };
    }

    this.btn = {};
    for (const id of ['dodgeL', 'dodgeR', 'block', 'super', 'pause']) {
      const p = this.pos[id];
      const b = img(scene, p.x, p.y, `btn_${id}`).setDepth(DEPTH);
      if (this.btnScale && id !== 'pause') b.setScale(b.scaleX * this.btnScale).setAlpha(0.9);
      b.baseScale = b.scaleX;
      this.btn[id] = b;
    }
    this.btn.super.setAlpha(0.8);

    // Super meter ring
    this.superRing = scene.add.graphics().setDepth(DEPTH + 1);

    // Shield pips above the block button
    this.pips = [];
    this.pipY = this.pos.block.y - (this.tourney ? 56 : 70);

    // Bars
    this.bars = scene.add.graphics().setDepth(DEPTH);
    this.enemyBar = { x: W / 2 - 220, y: 40, w: 440, h: 16 };
    this.playerBar = { x: W / 2 - 150, y: H - 22 - padB, w: 300, h: 12 };
    if (this.tourney) this._buildTourneyBar(scene, enemyName, tourney);
    else {
      this.enemyName = text(scene, W / 2, 20, enemyName, {
        fontSize: '19px', fontStyle: '700', color: PALETTE.parchmentCss, stroke: PALETTE.inkCss, strokeThickness: 5,
      }).setDepth(DEPTH);
    }
    this.vals = { enemy: 1, player: 1, stagger: 0, open: 0, superF: 0 };

    // Hit counter
    this.counter = text(scene, W - padR - (VIEW.portrait ? 80 : 130), VIEW.portrait ? Math.round(H * 0.3) : 190, '', {
      fontSize: '40px', fontStyle: '700', color: PALETTE.goldLight, stroke: PALETTE.inkCss, strokeThickness: 7,
    }).setDepth(DEPTH).setAlpha(0);

    // Banner / prompts
    this.bannerY = bannerY;
    // The tutorial arrow sits below the banner, or above it when the banner is low.
    this.arrowY = bannerY > 280 ? bannerY - 105 : bannerY + 94;
    this.bannerBg = img(scene, W / 2, bannerY, 'banner').setDepth(DEPTH + 5).setAlpha(0);
    this.bannerText = text(scene, W / 2, bannerY, '', {
      fontSize: '21px', fontStyle: '700', color: PALETTE.inkCss, wordWrap: { width: Math.min(560, W - 90) }, lineSpacing: 2,
    }).setDepth(DEPTH + 6).setAlpha(0);
    this.promptArrow = text(scene, W / 2, this.arrowY, '', {
      fontSize: '92px', fontStyle: '700', color: PALETTE.goldLight, stroke: PALETTE.inkCss, strokeThickness: 8,
    }).setDepth(DEPTH + 6).setAlpha(0);
    this.pulsing = new Set();

    // Debug overlay
    this.debugOn = false;
    this.debugText = text(scene, padL + 110, 100, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.6)', align: 'left',
      originX: 0, originY: 0, padding: { x: 6, y: 4 },
    }).setDepth(60).setVisible(false);

    // Strike hint: a chevron over the foe showing which way to swipe.
    this.hint = scene.add.container(0, 0).setDepth(DEPTH - 2).setAlpha(0);
    this.hintArrow = img(scene, 0, 0, 'chev');
    this.hintLabel = text(scene, 0, 0, '', {
      fontSize: '15px', fontStyle: '700', color: '#fff3c4', stroke: PALETTE.inkCss, strokeThickness: 4,
    });
    this.hint.add([this.hintArrow, this.hintLabel]);

    this.realT = 0;
  }

  showHint(dir, label, kind = 'combo') {
    const ang = { E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: -135, N: -90, NE: -45 }[dir] ?? 0;
    this.hintDir = dir;
    this.hintArrow.setAngle(ang).setTint(kind === 'riposte' ? 0xffffff : 0xf6d061);
    // Slim and a little see-through, so he and his open glow read through it; the
    // label sits off to the side, clear of his body and the callouts.
    this.hintBase = (kind === 'riposte' ? 1.0 : 0.72) / VIEW.RES;
    this.hintArrow.setAlpha(kind === 'riposte' ? 0.9 : 0.78);
    this.hintLabel.setText(label).setColor(kind === 'riposte' ? '#ffffff' : '#fff3c4').setOrigin(0, 0.5).setPosition(VIEW.portrait ? 58 : 72, 34);
    this.scene.tweens.killTweensOf(this.hint);
    this.hint.setAlpha(1);
    this.hintArrow.setScale(this.hintBase * 1.5);
    this.scene.tweens.add({ targets: this.hintArrow, scale: this.hintBase, duration: 160, ease: 'Back.easeOut' });
  }

  placeHint(x, y) {
    if (this.hint.alpha <= 0) return;
    // Bob along the swipe direction so it reads as motion.
    const v = { E: [1, 0], SE: [0.7, 0.7], S: [0, 1], SW: [-0.7, 0.7], W: [-1, 0], NW: [-0.7, -0.7], N: [0, -1], NE: [0.7, -0.7] }[this.hintDir] || [0, 0];
    const k = ((this.realT % 600) / 600) * 26 - 13;
    this.hint.setPosition(x + v[0] * k, y - 10 + v[1] * k);
    // Keep the label on screen: flip it to his other side near the right edge.
    const off = VIEW.portrait ? 58 : 72;
    const flip = x + off + this.hintLabel.width > VIEW.W - 24;
    this.hintLabel.setOrigin(flip ? 1 : 0, 0.5).setX(flip ? -off : off);
  }

  hideHint() {
    if (this.hint.alpha <= 0) return;
    this.scene.tweens.killTweensOf(this.hint);
    this.scene.tweens.add({ targets: this.hint, alpha: 0, duration: 140 });
  }

  // Small key labels under the roundels for keyboard players.
  showKeyHints() {
    if (this.keyHints) return;
    const label = { dodgeL: 'A', dodgeR: 'D', block: 'S', super: 'W', pause: 'Esc' };
    this.keyHints = Object.entries(label).map(([id, k]) => {
      const p = this.pos[id];
      const below = p.y < VIEW.H / 2;
      return text(this.scene, p.x, below ? p.y + p.r + 10 : p.y - p.r - 10, k, {
        fontSize: '13px', fontStyle: '700', color: '#f3ead2', backgroundColor: 'rgba(20,14,10,0.75)', padding: { x: 5, y: 1 },
      }).setDepth(DEPTH + 2);
    });
    const tip = text(this.scene, VIEW.W / 2, this.pos.block.y - this.pos.block.r - 26, 'Arrow keys strike · two at once for diagonals', {
      fontSize: '12px', color: '#f3ead2', backgroundColor: 'rgba(20,14,10,0.6)', padding: { x: 6, y: 2 },
    }).setDepth(DEPTH + 2);
    this.scene.tweens.add({ targets: tip, alpha: 0, delay: 6000, duration: 800, onComplete: () => tip.destroy() });
    this.keyHints.push(tip);
  }

  _buildTourneyBar(scene, enemyName, t) {
    const W = VIEW.W;
    const P = VIEW.portrait;
    const plaqueW = 112;
    // Landscape: you on the left, him on the right, the round between. Portrait: two
    // full-width rows, him on top, with the round plaque at the right.
    const panelW = P ? W - 40 - plaqueW - 10 : Math.min(440, (W - 40 - plaqueW - 16) / 2);
    const panelH = 60;
    const top = 8;
    const crestW = 50;
    const crestH = 60;
    const leftX = P ? 20 : W / 2 - plaqueW / 2 - 8 - panelW;
    const rightX = P ? 20 : W / 2 + plaqueW / 2 + 8;
    const playerTop = P ? top + panelH + 20 : top;
    const panel = (key, field, crest, crestLeft) => canvasTex(scene, key, panelW, panelH + 16, (ctx, w) => {
      roundRect(ctx, 3, 3, w - 6, panelH - 6, 6);
      const g = ctx.createLinearGradient(0, 0, 0, panelH);
      g.addColorStop(0, field);
      g.addColorStop(1, '#0e0f18');
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 4;
      ctx.strokeStyle = PALETTE.goldCss;
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = PALETTE.inkCss;
      ctx.stroke();
      const cx = crestLeft ? 6 : w - crestW - 6;
      drawCrest(ctx, cx, 2, crestW, crestH + 10, crest.field, crest.charge, crest.color);
    });
    const pKey = panel(`tb_p_${W}`, '#22346e', t.playerCrest, true);
    const eKey = panel(`tb_e_${t.enemyId}_${W}`, t.enemyCrest.field, t.enemyCrest, P);
    img(scene, leftX, playerTop, pKey, 0, 0).setDepth(DEPTH);
    img(scene, rightX, top, eKey, 0, 0).setDepth(DEPTH);
    const nameStyle = { fontSize: '20px', fontStyle: '700', color: '#f3ead2', stroke: PALETTE.inkCss, strokeThickness: 4 };
    text(scene, leftX + crestW + 22, playerTop + 19, t.playerName, { ...nameStyle, originX: 0 }).setDepth(DEPTH + 1);
    if (P) text(scene, rightX + crestW + 22, top + 19, enemyName, { ...nameStyle, originX: 0 }).setDepth(DEPTH + 1);
    else text(scene, rightX + panelW - crestW - 22, top + 19, enemyName, { ...nameStyle, originX: 1 }).setDepth(DEPTH + 1);
    canvasTex(scene, 'tb_plaque', plaqueW, 72, (ctx, w, h) => {
      roundRect(ctx, 3, 3, w - 6, h - 6, 5);
      ctx.fillStyle = '#efe2c0';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = PALETTE.goldCss;
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = PALETTE.inkCss;
      ctx.stroke();
      ctx.fillStyle = PALETTE.vermilionCss;
      ctx.fillRect(w / 2 - 14, h - 14, 28, 2);
      ctx.fillRect(w / 2 - 2, h - 18, 4, 10);
    });
    const plaqueX = P ? W - 20 - plaqueW / 2 : W / 2;
    img(scene, plaqueX, top, 'tb_plaque', 0.5, 0).setDepth(DEPTH);
    text(scene, plaqueX, top + 18, 'Round', { fontSize: '16px', fontStyle: '700' }).setDepth(DEPTH + 1);
    text(scene, plaqueX, top + 41, `${t.round}/${t.rounds}`, { fontSize: '23px', fontStyle: '700' }).setDepth(DEPTH + 1);
    const segX = (x0) => x0 + crestW + 20;
    const segW = panelW - crestW - 40;
    this.bars.setDepth(DEPTH + 1);   // segments draw over the panels
    this.tb = {
      top, panelW, panelH, segW,
      pSeg: { x: segX(leftX), y: playerTop + 36 },
      eSeg: { x: P ? segX(rightX) : rightX + 20, y: top + 36 },
    };
  }

  _drawSegments(g, x, y, w, frac, fill) {
    const n = 10;
    const gap = 3;
    const sw = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const sx = x + i * (sw + gap);
      g.fillStyle(0x140c0a, 0.9);
      g.fillRect(sx - 1, y - 1, sw + 2, 16);
      g.fillStyle(0x3a1a16, 1);
      g.fillRect(sx, y, sw, 14);
      const f = Math.max(0, Math.min(1, frac * n - i));
      if (f > 0) {
        g.fillStyle(fill, 1);
        g.fillRect(sx, y, sw * f, 14);
        g.fillStyle(0xffffff, 0.22);
        g.fillRect(sx, y, sw * f, 4);
      }
    }
  }

  setPips(n, max) {
    if (this.pips.length !== max) {
      this.pips.forEach((p) => p.destroy());
      this.pips = [];
      for (let i = 0; i < max; i++) {
        const x = this.pos.block.x + (i - (max - 1) / 2) * 20;
        this.pips.push(img(this.scene, x, this.pipY, 'pip_on').setDepth(DEPTH));
      }
    }
    this.pips.forEach((p, i) => p.setTexture(i < n ? 'pip_on' : 'pip_off'));
  }

  set(vals) {
    Object.assign(this.vals, vals);
  }

  press(id, down) {
    const b = this.btn[id];
    if (!b) return;
    b.setScale(b.baseScale * (down ? 0.9 : 1));
    if (down) b.setTint(0xe8d8b0);
    else b.clearTint();
  }

  pulse(ids, on) {
    ids.forEach((id) => (on ? this.pulsing.add(id) : this.pulsing.delete(id)));
    if (!on) ids.forEach((id) => this.btn[id] && this.btn[id].setScale(this.btn[id].baseScale));
  }

  _drawBars() {
    const g = this.bars;
    g.clear();
    const v = this.vals;
    if (this.tourney) {
      const t = this.tb;
      this._drawSegments(g, t.pSeg.x, t.pSeg.y, t.segW, v.player, 0xd23a2a);
      this._drawSegments(g, t.eSeg.x, t.eSeg.y, t.segW, v.enemy, 0xd23a2a);
      // Stagger meter and open window under the enemy's panel.
      const sy = t.top + t.panelH + 2;
      g.fillStyle(PALETTE.ink, 0.75);
      g.fillRect(t.eSeg.x, sy, t.segW, 6);
      g.fillStyle(0xf6d061, 1);
      g.fillRect(t.eSeg.x, sy, t.segW * v.stagger, 6);
      if (v.open > 0) {
        g.fillStyle(0xfff6cf, 0.95);
        g.fillRect(t.eSeg.x, sy + 9, t.segW * v.open, 4);
      }
      this._drawSuperRing();
      return;
    }
    // Enemy health
    const e = this.enemyBar;
    g.fillStyle(PALETTE.ink, 0.85);
    g.fillRoundedRect(e.x - 4, e.y - 4, e.w + 8, e.h + 8, 6);
    g.fillStyle(0x5a1a10, 1);
    g.fillRect(e.x, e.y, e.w, e.h);
    g.fillStyle(PALETTE.vermilion, 1);
    g.fillRect(e.x, e.y, e.w * v.enemy, e.h);
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(e.x, e.y, e.w * v.enemy, 4);
    // Stagger meter
    const sy = e.y + e.h + 7;
    g.fillStyle(PALETTE.ink, 0.75);
    g.fillRect(e.x + 60, sy, e.w - 120, 7);
    g.fillStyle(0xf6d061, 1);
    g.fillRect(e.x + 60, sy, (e.w - 120) * v.stagger, 7);
    // Open window
    if (v.open > 0) {
      g.fillStyle(0xfff6cf, 0.95);
      const ow = (e.w - 200) * v.open;
      g.fillRect(VIEW.W / 2 - ow / 2, sy + 11, ow, 4);
    }
    // Player health
    const p = this.playerBar;
    g.fillStyle(PALETTE.ink, 0.85);
    g.fillRoundedRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8, 6);
    g.fillStyle(0x14204a, 1);
    g.fillRect(p.x, p.y, p.w, p.h);
    g.fillStyle(PALETTE.lapis, 1);
    g.fillRect(p.x, p.y, p.w * v.player, p.h);
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(p.x, p.y, p.w * v.player, 3);

    this._drawSuperRing();
  }

  _drawSuperRing() {
    const v = this.vals;
    const r = this.superRing;
    r.clear();
    const sp = this.pos.super;
    r.lineStyle(6, PALETTE.ink, 0.6);
    r.strokeCircle(sp.x, sp.y, sp.r + 5);
    if (v.superF > 0) {
      r.lineStyle(5, v.superF >= 1 ? 0xfff6cf : 0xf6d061, 1);
      r.beginPath();
      r.arc(sp.x, sp.y, sp.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v.superF, false);
      r.strokePath();
    }
  }

  setSuperReady(ready) {
    if (this.superReady === ready) return;
    this.superReady = ready;
    this.btn.super.setTexture(ready ? 'btn_super_lit' : 'btn_super').setAlpha(ready ? 1 : 0.8);
  }

  // The gap in his guard: a faint double arrow (↔ for a high guard, ↕ for a low one).
  showGap(stance, x, y) {
    if (!this.gap) {
      this.gap = this.scene.add.container(0, 0).setDepth(DEPTH - 3);
      const a = img(this.scene, 40, 0, 'chev');
      const b = img(this.scene, -40, 0, 'chev').setAngle(180);
      [a, b].forEach((o) => o.setScale(0.8 / VIEW.RES).setTint(0xfff3c4));
      this.gap.add([a, b]);
    }
    if (this.gapStance !== stance) {
      this.gapStance = stance;
      this.gap.setAngle(stance === 'high' ? 0 : 90);
      this.gap.setScale(1.4);
      this.scene.tweens.add({ targets: this.gap, scale: 1, duration: 200, ease: 'Back.easeOut' });
    }
    this.gap.setVisible(true).setAlpha(0.72 + Math.sin(this.realT / 220) * 0.14);
    this.gap.setPosition(x, y - 46);   // over the shoulders, clear of his shield
  }

  hideGap() {
    if (this.gap) this.gap.setVisible(false);
    this.gapStance = null;
  }

  // Blade lock: a strength bar (you from the left in blue, him from the right in red) and TAP!
  showLock(on) {
    if (!this.lockG) {
      this.lockY = VIEW.portrait ? Math.round(VIEW.H * 0.7) : 418;
      this.lockG = this.scene.add.graphics().setDepth(DEPTH + 3);
      this.lockTxt = text(this.scene, VIEW.W / 2, this.lockY - 44, 'TAP!', {
        fontSize: '34px', fontStyle: '700', color: '#fff6cf', stroke: PALETTE.inkCss, strokeThickness: 7,
      }).setDepth(DEPTH + 3);
    }
    this.lockOn = on;
    this.lockG.setVisible(on);
    this.lockTxt.setVisible(on);
    if (on) this.setLock(0.5);
  }

  setLock(v) {
    const g = this.lockG;
    const w = Math.min(340, VIEW.W - 120);
    const x = VIEW.W / 2 - w / 2;
    const y = this.lockY;
    g.clear();
    g.fillStyle(PALETTE.ink, 0.85).fillRoundedRect(x - 6, y - 6, w + 12, 26, 8);
    g.fillStyle(0xb02a1c, 1).fillRect(x, y, w, 14);
    g.fillStyle(0x3f63c8, 1).fillRect(x, y, w * Math.max(0, Math.min(1, v)), 14);
    g.fillStyle(0xffffff, 0.25).fillRect(x, y, w, 4);
    const mx = x + w * Math.max(0, Math.min(1, v));
    g.fillStyle(0xfff6cf, 1).fillTriangle(mx, y - 2, mx - 9, y - 14, mx + 9, y - 14);
    g.fillStyle(0xfff6cf, 1).fillTriangle(mx, y + 16, mx - 9, y + 28, mx + 9, y + 28);
    this.lockTxt.setScale(1 + Math.sin(this.realT / 70) * 0.06);
  }

  pulseLock() {
    if (!this.lockTxt) return;
    this.lockTxt.setScale(1.3);
  }

  // Clear the screen for a cinematic moment (the finishing blow).
  cinematic(on) {
    // A cut, not a tween: tweens run in slow motion during the finisher.
    this.scene.children.list.filter((o) => o.depth >= DEPTH - 2 && o.depth <= DEPTH + 2).forEach((o) => o.setAlpha(on ? 0 : 1));
    this.superRing.setVisible(!on);
    this.bars.setVisible(!on);
  }

  showCounter(n) {
    if (n < 2) return;
    this.counter.setText(`×${n}`).setAlpha(1).setScale(1.4);
    this.scene.tweens.killTweensOf(this.counter);
    this.scene.tweens.add({ targets: this.counter, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.counter, alpha: 0, delay: 700, duration: 300 });
  }

  bigText(str, color = PALETTE.goldLight, y = 210, size = 54) {
    if (VIEW.portrait) {
      y = Math.round(VIEW.H * 0.24 + (y - 200) * 0.8);
      size = Math.min(size, 46);
    }
    const t = text(this.scene, VIEW.W / 2, y, str, {
      fontSize: `${size}px`, fontStyle: '700', color, stroke: PALETTE.inkCss, strokeThickness: 8,
    }).setDepth(DEPTH + 4).setScale(0.6).setAlpha(0);
    this.scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 140, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, alpha: 0, y: y - 30, delay: 650, duration: 350, onComplete: () => t.destroy() });
  }

  // Persistent banner (tutorial prompts, phase messages). ms = 0 keeps it up.
  banner(str, ms = 2400, arrow = '') {
    this.bannerText.setText(str);
    const tw = Math.min(600, Math.max(320, this.bannerText.width + 70));
    const th = Math.max(70, this.bannerText.height + 34);
    this.bannerBg.setDisplaySize(tw, th);
    this.scene.tweens.killTweensOf([this.bannerBg, this.bannerText, this.promptArrow]);
    this.bannerBg.setAlpha(1);
    this.bannerText.setAlpha(1);
    this.promptArrow.setText(arrow).setAlpha(arrow ? 1 : 0);
    if (this._bannerTimer) this._bannerTimer.remove();
    this._bannerTimer = null;
    if (ms > 0) this._bannerTimer = this.scene.time.delayedCall(ms, () => this.hideBanner());
  }

  hideBanner(now = false) {
    const t = [this.bannerBg, this.bannerText, this.promptArrow];
    if (now) {
      this.scene.tweens.killTweensOf(t);
      if (this._bannerTimer) this._bannerTimer.remove();
      t.forEach((o) => o.setAlpha(0));
      return;
    }
    this.scene.tweens.add({ targets: t, alpha: 0, duration: 250 });
  }

  toggleDebug() {
    this.debugOn = !this.debugOn;
    this.debugText.setVisible(this.debugOn);
  }

  update(realDelta, debugInfo) {
    this.realT += realDelta;
    this._drawBars();
    const k = 1 + Math.sin(this.realT / 130) * 0.09;
    for (const id of this.pulsing) {
      const b = this.btn[id];
      if (b) b.setScale(b.baseScale * k);
    }
    if (this.superReady) {
      this.btn.super.setScale(this.btn.super.baseScale * (1 + Math.sin(this.realT / 160) * 0.06));
    }
    if (this.promptArrow.alpha > 0) {
      this.promptArrow.y = this.arrowY + Math.sin(this.realT / 120) * 10;
    }
    if (this.debugOn && debugInfo) this.debugText.setText(debugInfo());
  }
}
