import { CONFIG, VIEW, PALETTE } from '../config.js';
import { canvasTex, img, text, star, roundRect } from '../art/Tex.js';
import { drawCrest } from '../art/Heraldry.js';
import { Save } from '../save/Save.js';

const DEPTH = 40;
// The line-art buttons (brief 34, after Infinity Blade): a thin gold stroke over a soft
// dark shadow, no gilt disc, so the fighters' feet show through.
const LINE = '#f4d070';

// Stroke the current path as line art: a dark shadow first, then the gold line.
function lineArt(ctx, w = 3, color = LINE) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(20,12,8,0.6)';
  ctx.lineWidth = w + 3;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

// Double chevron pointing left (dir 1) or right (dir -1): the dodge buttons.
function iconChevrons(ctx, cx, cy, s, dir) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(dir, 1);
  ctx.beginPath();
  [-5, 17].forEach((ox) => {
    ctx.moveTo(ox + s * 0.5, -s);
    ctx.lineTo(ox - s * 0.45, 0);
    ctx.lineTo(ox + s * 0.5, s);
  });
  lineArt(ctx, 3.5);
  ctx.restore();
}

// Heater shield outline: the block button (the count is drawn inside it as text).
function iconShield(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s * 0.9);
  ctx.lineTo(cx + s, cy - s * 0.9);
  ctx.lineTo(cx + s, cy);
  ctx.quadraticCurveTo(cx + s * 0.9, cy + s * 0.9, cx, cy + s * 1.3);
  ctx.quadraticCurveTo(cx - s * 0.9, cy + s * 0.9, cx - s, cy);
  ctx.closePath();
  ctx.fillStyle = 'rgba(20,12,8,0.35)';
  ctx.fill();
  lineArt(ctx, 3);
}

function makeButtonTextures(scene) {
  const R = 54;
  const S = R * 2 + 4;
  canvasTex(scene, 'btn_dodgeL', S, S, (ctx) => iconChevrons(ctx, S / 2, S / 2, 22, 1));
  canvasTex(scene, 'btn_dodgeR', S, S, (ctx) => iconChevrons(ctx, S / 2, S / 2, 22, -1));
  canvasTex(scene, 'btn_block', S, S, (ctx) => iconShield(ctx, S / 2, S / 2 - 4, 26));
  const SR = 44;
  const SS = SR * 2 + 4;
  // The super: a small star that lights and pulses when it's ready.
  canvasTex(scene, 'btn_super', SS, SS, (ctx) => {
    star(ctx, SS / 2, SS / 2, 8, 20, 9);
    ctx.fillStyle = 'rgba(20,12,8,0.3)';
    ctx.fill();
    lineArt(ctx, 2.5);
  });
  canvasTex(scene, 'btn_super_lit', SS, SS, (ctx) => {
    ctx.save();
    ctx.shadowColor = 'rgba(255,230,150,0.9)';
    ctx.shadowBlur = 14;
    star(ctx, SS / 2, SS / 2, 8, 24, 11);
    ctx.fillStyle = '#fff6cf';
    ctx.fill();
    ctx.restore();
    star(ctx, SS / 2, SS / 2, 8, 24, 11);
    lineArt(ctx, 2.5, '#f6d061');
  });
  const PR = 28;
  const PS = PR * 2 + 4;
  canvasTex(scene, 'btn_pause', PS, PS, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(PS / 2 - 7, PS / 2 - 11);
    ctx.lineTo(PS / 2 - 7, PS / 2 + 11);
    ctx.moveTo(PS / 2 + 7, PS / 2 - 11);
    ctx.lineTo(PS / 2 + 7, PS / 2 + 11);
    lineArt(ctx, 4);
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
  // A small gold star, flanking the big-moment callouts.
  canvasTex(scene, 'callstar', 30, 30, (ctx) => {
    star(ctx, 15, 15, 8, 13, 5.5);
    ctx.fillStyle = '#f6d061';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.inkCss;
    ctx.stroke();
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
  // style 'tourney' = the third-person top bar: two thin bars between small crests (brief 34).
  constructor(scene, { enemyName, leftHanded, bannerY = 236, calloutY = 116, style = 'classic', tourney = null }) {
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
    // Hit zones (SwipeInput reads these radii): unchanged by the line-art redraw.
    this.pos = {
      dodgeL: { x: padL + 66, y: H - 70 - padB, r: 54 },
      dodgeR: { x: W - padR - 66, y: H - 70 - padB, r: 54 },
      block: { x: W / 2, y: H - 92 - padB, r: 54 },
      super: { x: superX, y: 62, r: 44 },
      pause: { x: pauseX, y: 44, r: 28 },
    };
    if (this.tourney) {
      // The buttons shrink and sink so the fighters' legs stay visible; the pause sits
      // in the corner under the thin top bar.
      const s = 0.82;
      this.btnScale = s;
      this.pos.dodgeL = { x: padL + 54, y: H - 52 - padB, r: 54 * s };
      this.pos.dodgeR = { x: W - padR - 54, y: H - 52 - padB, r: 54 * s };
      this.pos.block = { x: W / 2, y: H - 54 - padB, r: 54 * s };
      this.pos.super = { x: leftHanded ? W / 2 + 120 : W / 2 - 120, y: H - 46 - padB, r: 44 * s };
      this.pos.pause = { x: leftHanded ? padL + 36 : W - padR - 36, y: 78, r: 28 };
    }
    if (VIEW.portrait) {
      // Upright: a row of buttons along the bottom, the super above the left thumb.
      const s = 0.95;
      this.btnScale = s;
      this.pos.dodgeL = { x: padL + 66, y: H - 84 - padB, r: 54 * s };
      this.pos.dodgeR = { x: W - padR - 66, y: H - 84 - padB, r: 54 * s };
      this.pos.block = { x: W / 2, y: H - 96 - padB, r: 54 * s };
      this.pos.super = { x: leftHanded ? W - padR - 60 : padL + 60, y: H - 214 - padB, r: 44 * s };
      this.pos.pause = { x: leftHanded ? padL + 36 : W - padR - 36, y: 96, r: 28 };
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
    // Each side of the screen dodges: a see-through strip from under the top bar to the
    // bottom edge. The chevron stays in its corner as the marker; the veil brightens with it.
    const sw = Math.round(W * (VIEW.portrait ? CONFIG.hud.dodgeStripPortrait : CONFIG.hud.dodgeStrip));
    const top = CONFIG.hud.dodgeStripTop;
    this.zones = {
      dodgeL: { x: 0, y: top, w: sw, h: H - top, inner: sw, dir: 1 },
      dodgeR: { x: W - sw, y: top, w: sw, h: H - top, inner: W - sw, dir: -1 },
    };
    this.zoneG = scene.add.graphics().setDepth(DEPTH - 1);
    this.btn.pause.setAlpha(0.7);
    // The blocks left, as a number inside the shield (was a row of pips).
    const bs = this.btnScale || 1;
    this.blockCount = text(scene, this.pos.block.x, this.pos.block.y - 2 * bs, '', {
      fontSize: `${Math.round(24 * bs)}px`, fontStyle: '700', color: '#fff0b8', stroke: PALETTE.inkCss, strokeThickness: 4,
    }).setDepth(DEPTH + 1);

    // Super meter ring
    this.superRing = scene.add.graphics().setDepth(DEPTH + 1);

    // Bars
    this.bars = scene.add.graphics().setDepth(DEPTH);
    this.enemyBar = { x: W / 2 - 220, y: 40, w: 440, h: 16 };
    this.playerBar = { x: W / 2 - 150, y: H - 22 - padB, w: 300, h: 12 };
    if (this.tourney) this._buildTourneyBar(scene, tourney, padL, padR);
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

    // Banner / prompts: in the band under the bars, never across the fighters.
    this.bannerY = bannerY;
    this.calloutY = calloutY;
    this.bannerBg = img(scene, W / 2, bannerY, 'banner').setDepth(DEPTH + 5).setAlpha(0);
    this.bannerText = text(scene, W / 2, bannerY, '', {
      fontSize: VIEW.portrait ? '20px' : '19px', fontStyle: '700', color: PALETTE.inkCss, wordWrap: { width: Math.min(560, W - 90) }, lineSpacing: 2,
    }).setDepth(DEPTH + 6).setAlpha(0);
    // The tutorial's prompt: a ghost swipe stroke across the swipe area (was a 92 px arrow glyph).
    this.ghost = scene.add.graphics().setDepth(DEPTH + 6);
    this.ghostDir = null;
    this.pulsing = new Set();

    // Debug overlay
    this.debugOn = false;
    this.debugText = text(scene, padL + 110, 100, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.6)', align: 'left',
      originX: 0, originY: 0, padding: { x: 6, y: 4 },
    }).setDepth(60).setVisible(false);

    // Strike hint: a chevron over the foe showing which way to swipe (no label).
    this.hint = scene.add.container(0, 0).setDepth(DEPTH - 2).setAlpha(0);
    this.hintArrow = img(scene, 0, 0, 'chev');
    this.hint.add([this.hintArrow]);

    this.realT = 0;
  }

  // The gold strike chevrons are training wheels: the tutorial and the first duels
  // after it, then never (the sequences stay in the Book of Arms and in camp).
  strikeHintsOn() {
    return Save.data.wins < CONFIG.hud.strikeHintWins;
  }

  // kind 'combo': the next cut of a known strike, while the hints are on.
  // kind 'riposte': the return cut after a parry, a short flash rather than a persistent icon.
  showHint(dir, kind = 'combo') {
    if (kind === 'combo' && !this.strikeHintsOn()) return;
    const ang = { E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: -135, N: -90, NE: -45 }[dir] ?? 0;
    this.hintDir = dir;
    this.hintArrow.setAngle(ang).setTint(kind === 'riposte' ? 0xffffff : 0xf6d061);
    // Slim and a little see-through, so he and his open glow read through it.
    this.hintBase = (kind === 'riposte' ? 1.0 : 0.72) / VIEW.RES;
    this.hintArrow.setAlpha(kind === 'riposte' ? 0.9 : 0.78);
    this.scene.tweens.killTweensOf(this.hint);
    this.hint.setAlpha(1);
    this.hintFlashUntil = kind === 'riposte' ? this.realT + CONFIG.hud.riposteFlashMs : null;
    this.hintArrow.setScale(this.hintBase * 1.5);
    this.scene.tweens.add({ targets: this.hintArrow, scale: this.hintBase, duration: 160, ease: 'Back.easeOut' });
  }

  placeHint(x, y) {
    if (this.hint.alpha <= 0) return;
    // Bob along the swipe direction so it reads as motion.
    const v = { E: [1, 0], SE: [0.7, 0.7], S: [0, 1], SW: [-0.7, 0.7], W: [-1, 0], NW: [-0.7, -0.7], N: [0, -1], NE: [0.7, -0.7] }[this.hintDir] || [0, 0];
    const k = ((this.realT % 600) / 600) * 26 - 13;
    this.hint.setPosition(x + v[0] * k, y - 10 + v[1] * k);
  }

  hideHint() {
    if (this.hint.alpha <= 0) return;
    this.hintFlashUntil = null;
    this.scene.tweens.killTweensOf(this.hint);
    this.scene.tweens.add({ targets: this.hint, alpha: 0, duration: 140 });
  }

  // Small key labels by the buttons for keyboard players (the tip line lives in camp).
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
  }

  // Two thin bars joined at the middle, a small crest at each end: yours on the left
  // (blue; white while the cheat is on), his on the right (red). No names, no round
  // plaque: those belong on the entrance banner.
  _buildTourneyBar(scene, t, padL, padR) {
    const W = VIEW.W;
    const top = 10;
    const crestW = 30;
    const crestH = 36;
    const crest = (key, c) => canvasTex(scene, key, crestW + 6, crestH + 6, (ctx) => drawCrest(ctx, 3, 3, crestW, crestH, c.field, c.charge, c.color));
    const pKey = crest('tb_crest_p', t.playerCrest);
    const eKey = crest(`tb_crest_${t.enemyId}`, t.enemyCrest);
    img(scene, padL, top - 2, pKey, 0, 0).setDepth(DEPTH);
    img(scene, W - padR - crestW - 6, top - 2, eKey, 0, 0).setDepth(DEPTH);
    const h = 7;
    const y = top + 10;
    const gap = 14;
    this.bars.setDepth(DEPTH + 1);
    this.tb = {
      h, y,
      pBar: { x: padL + crestW + 14, y, w: W / 2 - gap - (padL + crestW + 14) },
      eBar: { x: W / 2 + gap, y, w: W - padR - crestW - 20 - (W / 2 + gap) },
      // Your crest doubles as the cheat switch.
      crest: { x: padL + 3 + crestW / 2, y: top + 1 + crestH / 2, w: crestW, h: crestH },
    };
  }

  setPips(n, max) {
    if (this.pipsShown === n) return;
    this.pipsShown = n;
    this.blockCount.setText(String(n)).setColor(n === 0 ? '#ff8a70' : '#fff0b8');
  }

  set(vals) {
    Object.assign(this.vals, vals);
  }

  press(id, down) {
    const b = this.btn[id];
    if (!b) return;
    b.setScale(b.baseScale * (down ? 0.9 : 1));
    if (down) b.pressedAt = this.realT;
    if (down) b.setTint(0xffffff);
    else b.clearTint();
  }

  // The dodge strips: a faint veil fading in from the screen edge, with a hairline at the
  // inner edge. Barely there at rest; brighter while he attacks; a flash when pressed.
  _drawZones() {
    const g = this.zoneG;
    g.clear();
    if (!g.visible) return;
    for (const id of ['dodgeL', 'dodgeR']) {
      const z = this.zones[id];
      const b = this.btn[id];
      const lit = Math.max(0, Math.min(1, (b.alpha - 0.48) / 0.47));
      const since = b.pressedAt === undefined ? Infinity : this.realT - b.pressedAt;
      const flash = since < 260 ? 1 - since / 260 : 0;
      const a = 0.045 + 0.06 * lit + 0.18 * flash;
      const n = 6;
      const sw = z.w / n;
      for (let i = 0; i < n; i++) {
        const x = z.dir > 0 ? z.x + i * sw : z.x + z.w - (i + 1) * sw;
        g.fillStyle(0xfff3c4, a * (1 - i / n));
        g.fillRect(x, z.y, sw + 0.5, z.h);
      }
      g.lineStyle(1.5, 0xfff3c4, 0.1 + 0.12 * lit + 0.3 * flash);
      g.lineBetween(z.inner, z.y + 12, z.inner, z.y + z.h - 12);
    }
  }

  pulse(ids, on) {
    ids.forEach((id) => (on ? this.pulsing.add(id) : this.pulsing.delete(id)));
    if (!on) ids.forEach((id) => this.btn[id] && this.btn[id].setScale(this.btn[id].baseScale));
  }

  // A thin bar with a lighter top edge, draining towards the middle of the screen.
  _thinBar(g, b, h, frac, fill, fromRight) {
    g.fillStyle(0x0c0a0e, 0.7);
    g.fillRoundedRect(b.x - 2, b.y - 2, b.w + 4, h + 4, 3);
    g.fillStyle(0x3a1c1a, 0.9);
    g.fillRect(b.x, b.y, b.w, h);
    const w = b.w * Math.max(0, Math.min(1, frac));
    if (w <= 0) return;
    const x = fromRight ? b.x + b.w - w : b.x;
    g.fillStyle(fill, 1);
    g.fillRect(x, b.y, w, h);
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(x, b.y, w, 2);
  }

  _drawBars() {
    const g = this.bars;
    g.clear();
    const v = this.vals;
    if (this.tourney) {
      const t = this.tb;
      this._thinBar(g, t.pBar, t.h, v.player, this.cheat ? 0xffffff : 0x3f63c8, false);
      this._thinBar(g, t.eBar, t.h, v.enemy, 0xd23a2a, true);
      // The emblem joining the bars.
      const cx = VIEW.W / 2;
      const cy = t.y + t.h / 2;
      g.fillStyle(PALETTE.ink, 0.8);
      g.fillTriangle(cx, cy - 9, cx - 7, cy, cx + 7, cy);
      g.fillTriangle(cx, cy + 9, cx - 7, cy, cx + 7, cy);
      g.fillStyle(0xf6d061, 1);
      g.fillTriangle(cx, cy - 7, cx - 5, cy, cx + 5, cy);
      g.fillTriangle(cx, cy + 7, cx - 5, cy, cx + 5, cy);
      // His stagger meter: a thin gold line under his bar (the opening is carried by his glow).
      const sy = t.y + t.h + 4;
      g.fillStyle(PALETTE.ink, 0.6);
      g.fillRect(t.eBar.x, sy, t.eBar.w, 3);
      if (v.stagger > 0) {
        const w = t.eBar.w * Math.min(1, v.stagger);
        g.fillStyle(0xf6d061, 1);
        g.fillRect(t.eBar.x + t.eBar.w - w, sy, w, 3);
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
    // Open window (the 2D figures have no open glow, so the bar stays here).
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
    g.fillStyle(this.cheat ? 0xffffff : PALETTE.lapis, 1);
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
    r.lineStyle(4, PALETTE.ink, 0.45);
    r.strokeCircle(sp.x, sp.y, sp.r + 3);
    if (v.superF > 0) {
      r.lineStyle(3, v.superF >= 1 ? 0xfff6cf : 0xf6d061, 0.95);
      r.beginPath();
      r.arc(sp.x, sp.y, sp.r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v.superF, false);
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
    this.zoneG.setVisible(!on);
  }

  showCounter(n) {
    if (n < 2) return;
    this.counter.setText(`×${n}`).setAlpha(1).setScale(1.4);
    this.scene.tweens.killTweensOf(this.counter);
    this.scene.tweens.add({ targets: this.counter, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.counter, alpha: 0, delay: 700, duration: 300 });
  }

  // A one-word callout, after Infinity Blade: small, at the top centre under the
  // bars, clear of the fighters; one at a time (a newer one replaces it), gone in
  // under a second. kind: 'good' (yours), 'bad' (his), 'warn'. The big moments
  // (stagger, blade lock, disarm, known strikes, the Pendragon) use the same word
  // about 1.3× the size, flanked by gold stars.
  callout(str, kind = 'good', { big = false } = {}) {
    const color = { good: '#fff0b8', bad: '#ff8a70', warn: '#ffc38a' }[kind] || '#fff0b8';
    const y = this.calloutY;
    this._dropCallout();
    // Shown at once and timed on real time (update()), so hit-stop and slow motion
    // can't hold it back.
    const size = (VIEW.portrait ? 24 : 26) * (big ? CONFIG.hud.calloutBig : 1);
    const t = text(this.scene, VIEW.W / 2, y, str.toUpperCase(), {
      fontSize: `${Math.round(size)}px`, fontStyle: '700', color, stroke: PALETTE.inkCss, strokeThickness: big ? 5 : 4,
    }).setDepth(DEPTH + 4);
    t.bornAt = this.realT;
    t.life = big ? 1100 : 880;
    this.calloutText = t;
    if (big) {
      const dx = t.width / 2 + 22;
      this.calloutStars = [-1, 1].map((s) => img(this.scene, VIEW.W / 2 + s * dx, y, 'callstar').setDepth(DEPTH + 4));
    }
  }

  _dropCallout() {
    if (this.calloutText) this.calloutText.destroy();
    (this.calloutStars || []).forEach((s) => s.destroy());
    this.calloutText = null;
    this.calloutStars = null;
  }

  _updateCallout() {
    const t = this.calloutText;
    if (!t) return;
    const age = this.realT - t.bornAt;
    const scale = age < 90 ? 0.85 + 0.15 * (age / 90) : 1;
    const fadeAt = t.life - 260;
    const alpha = age < fadeAt ? 1 : Math.max(0, 1 - (age - fadeAt) / 260);
    t.setScale(scale).setAlpha(alpha);
    (this.calloutStars || []).forEach((s) => s.setScale(scale / VIEW.RES).setAlpha(alpha).setAngle(age / 6));
    if (age > t.life) this._dropCallout();
  }

  // Big centre text: kept for the end of the duel (victory, defeat, the Green Knight rising).
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

  // Persistent banner (tutorial prompts, lessons, phase messages). ms = 0 keeps it up.
  // swipeDir ('N', 'E'...) adds a ghost swipe stroke in that direction across the swipe area.
  banner(str, ms = 2400, swipeDir = '') {
    this.bannerText.setText(str);
    const tw = Math.min(600, Math.max(320, this.bannerText.width + 70));
    const th = Math.max(64, this.bannerText.height + 30);
    this.bannerBg.setDisplaySize(tw, th);
    this.scene.tweens.killTweensOf([this.bannerBg, this.bannerText]);
    this.bannerBg.setAlpha(1);
    this.bannerText.setAlpha(1);
    this.ghostDir = swipeDir || null;
    if (!this.ghostDir) this.ghost.clear();
    if (this._bannerTimer) this._bannerTimer.remove();
    this._bannerTimer = null;
    if (ms > 0) this._bannerTimer = this.scene.time.delayedCall(ms, () => this.hideBanner());
  }

  hideBanner(now = false) {
    const t = [this.bannerBg, this.bannerText];
    this.ghostDir = null;
    this.ghost.clear();
    if (now) {
      this.scene.tweens.killTweensOf(t);
      if (this._bannerTimer) this._bannerTimer.remove();
      t.forEach((o) => o.setAlpha(0));
      return;
    }
    this.scene.tweens.add({ targets: t, alpha: 0, duration: 250 });
  }

  // The ghost swipe: a short stroke that sweeps along the prompted direction and fades,
  // over and over, in the middle of the swipe area.
  _drawGhostSwipe() {
    const g = this.ghost;
    g.clear();
    const v = { E: [1, 0], SE: [0.7, 0.7], S: [0, 1], SW: [-0.7, 0.7], W: [-1, 0], NW: [-0.7, -0.7], N: [0, -1], NE: [0.7, -0.7] }[this.ghostDir];
    if (!v) return;
    const period = 1100;
    const u = (this.realT % period) / period;
    if (u > 0.72) return;   // a pause between strokes
    const k = u / 0.72;
    const L = Math.min(VIEW.W, VIEW.H) * 0.44;
    const cx = VIEW.W / 2;
    const cy = VIEW.portrait ? VIEW.H * 0.5 : VIEW.H * 0.47;
    const head = Math.min(1, k * 1.15);
    const tail = Math.max(0, head - 0.42);
    const fade = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t0 = tail + (head - tail) * (i / n);
      const t1 = tail + (head - tail) * ((i + 1) / n);
      const w = CONFIG.swipe.trailWidth * 1.6 * (0.3 + 0.7 * ((i + 1) / n));
      const a = fade * (0.3 + 0.7 * ((i + 1) / n));
      const x0 = cx + v[0] * L * (t0 - 0.5);
      const y0 = cy + v[1] * L * (t0 - 0.5);
      const x1 = cx + v[0] * L * (t1 - 0.5);
      const y1 = cy + v[1] * L * (t1 - 0.5);
      g.lineStyle(w + 5, PALETTE.ink, a * 0.3);
      g.lineBetween(x0, y0, x1, y1);
      g.lineStyle(w, 0xf6d061, a);
      g.lineBetween(x0, y0, x1, y1);
    }
    const hx = cx + v[0] * L * (head - 0.5);
    const hy = cy + v[1] * L * (head - 0.5);
    g.fillStyle(0xfff6cf, fade);
    g.fillCircle(hx, hy, CONFIG.swipe.trailWidth * 1.2);
  }

  toggleDebug() {
    this.debugOn = !this.debugOn;
    this.debugText.setVisible(this.debugOn);
  }

  update(realDelta, debugInfo) {
    this.realT += realDelta;
    this._drawBars();
    this._updateCallout();
    const k = 1 + Math.sin(this.realT / 130) * 0.09;
    for (const id of this.pulsing) {
      const b = this.btn[id];
      if (b) b.setScale(b.baseScale * k);
    }
    if (this.superReady) {
      this.btn.super.setScale(this.btn.super.baseScale * (1 + Math.sin(this.realT / 160) * 0.08));
    }
    // Ghosted at rest, after Infinity Blade: the buttons brighten while he attacks,
    // when pressed, or when a lesson points at them.
    const alert = this.vals && this.vals.alert;
    for (const id of ['dodgeL', 'dodgeR', 'block', 'super']) {
      const b = this.btn[id];
      const lit = alert || this.pulsing.has(id) || (b.pressedAt !== undefined && this.realT - b.pressedAt < 600) || (id === 'super' && this.superReady);
      const want = lit ? 0.95 : 0.48;
      b.setAlpha(b.alpha + (want - b.alpha) * Math.min(1, realDelta / 90));
    }
    this.blockCount.setAlpha(this.btn.block.alpha).setScale(this.btn.block.scaleX / this.btn.block.baseScale);
    this._drawZones();
    // The riposte chevron is a flash, not a sign.
    if (this.hintFlashUntil && this.realT > this.hintFlashUntil) {
      this.hintFlashUntil = null;
      this.hideHint();
    }
    if (this.ghostDir) this._drawGhostSwipe();
    if (this.debugOn && debugInfo) this.debugText.setText(debugInfo());
  }
}
