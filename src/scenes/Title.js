import { CONFIG, VIEW, PALETTE } from '../config.js';
import { Save } from '../save/Save.js';
import { Sfx } from '../audio/Sfx.js';
import { ENEMIES } from '../combat/enemies.js';
import { img, text, canvasTex, roundRect } from '../art/Tex.js';
import { backgroundKey, borderKey } from '../art/Backgrounds.js';
import { drawShieldShape } from '../art/Rig.js';
import { DIR_ARROW } from '../input/SwipeInput.js';
import { menuButton, arrowButton } from '../ui/Button.js';
import { setupCamera, fadeTo } from './common.js';

function panel(scene, x, y, w, h) {
  const key = `panel_${w}x${h}`;
  canvasTex(scene, key, w, h, (ctx) => {
    roundRect(ctx, 4, 4, w - 8, h - 8, 14);
    ctx.fillStyle = 'rgba(241,227,196,0.93)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = PALETTE.goldCss;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.inkCss;
    ctx.stroke();
    roundRect(ctx, 12, 12, w - 24, h - 24, 8);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(43,74,155,0.5)';
    ctx.stroke();
  });
  return img(scene, x, y, key);
}

export class Title extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this._leaving = false;
    setupCamera(this);
    const W = VIEW.W;
    const H = VIEW.H;
    const s = Save.data;

    // Make sure equipped gear is still valid.
    if (!Save.unlocked(Save.sword())) Save.set({ sword: 'squire' });
    if (!Save.unlocked(Save.shield())) Save.set({ shield: 'targe' });

    img(this, W / 2, H / 2, backgroundKey(this, 'forest')).setAlpha(0.55);
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a1410, 0.25);
    img(this, W / 2, H / 2, borderKey(this)).setDepth(10);

    text(this, W / 2, 62, 'LOGRES', {
      fontSize: '74px', fontStyle: '700', color: PALETTE.goldLight, stroke: PALETTE.inkCss, strokeThickness: 10,
    }).setShadow(0, 4, 'rgba(0,0,0,0.4)', 6);
    text(this, W / 2, 112, 'Duels in the Matter of Britain', {
      fontSize: '19px', color: PALETTE.parchmentCss, stroke: PALETTE.inkCss, strokeThickness: 4,
    });

    const colW = Math.min(330, (W - 80) / 3);
    const leftX = W / 2 - colW - 14;
    const rightX = W / 2 + colW + 14;
    const panelY = 280;
    const panelH = 250;

    // ---------- left: the knight and his gear ----------
    panel(this, leftX, panelY, colW, panelH);
    text(this, leftX, panelY - 100, `Generation ${s.generation}`, { fontSize: '24px', fontStyle: '700' });
    const cycleTxt = s.cycle > 0 ? ` · Cycle ${s.cycle + 1}` : '';
    text(this, leftX, panelY - 72, `Level ${s.level}${cycleTxt} · Best run ${s.bestRun}`, { fontSize: '15px' });
    // XP bar
    const g = this.add.graphics();
    const bw = colW - 70;
    g.fillStyle(PALETTE.ink, 0.8).fillRoundedRect(leftX - bw / 2 - 3, panelY - 56, bw + 6, 12, 4);
    g.fillStyle(PALETTE.lapis, 1).fillRect(leftX - bw / 2, panelY - 53, bw * (s.xp / Save.xpToNext()), 6);

    this.swordText = this._selector(leftX, panelY - 12, CONFIG.swords, 'sword', colW);
    this.shieldText = this._selector(leftX, panelY + 70, CONFIG.shields, 'shield', colW);

    // ---------- centre: the shield and the call to arms ----------
    this._drawCrest(W / 2, 236);
    const next = ENEMIES[s.runStage] || ENEMIES[0];
    const playLabel = s.runStage === 0 ? 'Ride Out' : 'Continue';
    menuButton(this, W / 2, 398, 250, 66, playLabel, () => this._play(), { size: 30, fill: '#f6dc8a' });
    text(this, W / 2, 446, `Next foe: ${next.name}`, {
      fontSize: '17px', color: PALETTE.parchmentCss, stroke: PALETTE.inkCss, strokeThickness: 4,
    });

    // ---------- right: known strikes and settings ----------
    panel(this, rightX, panelY, colW, panelH);
    text(this, rightX, panelY - 100, 'Known Strikes', { fontSize: '22px', fontStyle: '700' });
    text(this, rightX, panelY - 76, 'swipe in one opening', { fontSize: '13px', color: '#5a4630' });
    CONFIG.combos.forEach((c, i) => {
      const y = panelY - 44 + i * 36;
      text(this, rightX, y, c.name, { fontSize: '15px', fontStyle: '700', color: PALETTE.vermilionCss });
      text(this, rightX, y + 18, c.seq.map((d) => DIR_ARROW[d]).join('  '), { fontSize: '18px', fontFamily: 'sans-serif', color: PALETTE.lapisCss });
    });

    const setY = panelY + 84;
    const bw3 = (colW - 40) / 3;
    this._toggle(rightX - bw3 - 6, setY, bw3, 'Sound', () => !Save.data.muted, (v) => {
      Save.set({ muted: !v });
      Sfx.setMuted(!v);
    });
    this._toggle(rightX, setY, bw3, 'Buzz', () => Save.data.vibration, (v) => Save.set({ vibration: v }));
    this._toggle(rightX + bw3 + 6, setY, bw3, 'Lefty', () => Save.data.leftHanded, (v) => Save.set({ leftHanded: v }));

    // Small footer
    text(this, W / 2, H - 30, 'Swipe to strike · Dodge and block with the roundels · Parry by swiping against a blow', {
      fontSize: '13px', color: PALETTE.parchmentCss, stroke: PALETTE.inkCss, strokeThickness: 3,
    });

    if (s.generation > 1 || s.wins > 0) {
      const reset = text(this, W - 70, H - 30, 'Reset', {
        fontSize: '12px', color: '#cdb98f', stroke: PALETTE.inkCss, strokeThickness: 3,
      }).setInteractive({ useHandCursor: true });
      let armed = false;
      reset.on('pointerup', () => {
        if (!armed) {
          armed = true;
          reset.setText('Tap again to erase');
          this.time.delayedCall(2500, () => { armed = false; reset.setText('Reset'); });
          return;
        }
        Save.reset();
        this.scene.restart();
      });
    }

    this.cameras.main.fadeIn(300, 26, 20, 16);
  }

  _drawCrest(x, y) {
    const sh = Save.shield();
    const sw = Save.sword();
    const key = `crest_${sh.id}_${sw.id}`;
    canvasTex(this, key, 220, 220, (ctx) => {
      // crossed swords behind
      ctx.save();
      ctx.translate(110, 110);
      [-0.6, 0.6].forEach((a) => {
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.rect(-6, -100, 12, 160);
        ctx.fillStyle = sw.color;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = PALETTE.inkCss;
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(-24, 60, 48, 9);
        ctx.fillStyle = sw.hilt;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
      ctx.restore();
      drawShieldShape(ctx, sh.id === 'targe' ? 'round' : 'heater', 110, 100, 64, sh.field, sh.charge);
    });
    if (this.crest) this.crest.destroy();
    this.crest = img(this, x, y, key);
  }

  _selector(x, y, list, kind, colW) {
    const nameT = text(this, x, y, '', { fontSize: '19px', fontStyle: '700' });
    const infoT = text(this, x, y + 24, '', { fontSize: '13px', color: '#5a4630' });
    text(this, x, y - 24, kind === 'sword' ? 'Sword' : 'Shield', { fontSize: '13px', color: PALETTE.vermilionCss, fontStyle: '700' });
    const refresh = () => {
      const cur = list.find((i) => i.id === Save.data[kind]) || list[0];
      nameT.setText(cur.name);
      infoT.setText(kind === 'sword'
        ? `Damage ×${cur.damage.toFixed(2)} · Swipe time ${Math.round(cur.tolerance * 100)}%`
        : `${cur.pips} pips · regains one every ${(cur.regenMs / 1000).toFixed(1)}s`);
    };
    const step = (d) => {
      const idx = list.findIndex((i) => i.id === Save.data[kind]);
      for (let k = 1; k <= list.length; k++) {
        const cand = list[(idx + d * k + list.length * 4) % list.length];
        if (Save.unlocked(cand)) {
          Save.set({ [kind]: cand.id });
          break;
        }
      }
      refresh();
      this._drawCrest(VIEW.W / 2, 236);
    };
    arrowButton(this, x - colW / 2 + 32, y + 6, -1, () => step(-1));
    arrowButton(this, x + colW / 2 - 32, y + 6, 1, () => step(1));
    refresh();
    const locked = list.filter((i) => !Save.unlocked(i));
    if (locked.length) {
      text(this, x, y + 42, `Next: ${locked[0].name} at Generation ${locked[0].unlockGen}`, { fontSize: '11px', color: '#7a6040' });
    }
    return nameT;
  }

  _toggle(x, y, w, label, get, set) {
    const b = menuButton(this, x, y, Math.round(w), 40, '', () => {
      set(!get());
      b.setLabel(`${label}: ${get() ? 'on' : 'off'}`);
    }, { size: 13 });
    b.setLabel(`${label}: ${get() ? 'on' : 'off'}`);
    return b;
  }

  _play() {
    Sfx.unlock();
    fadeTo(this, 'Duel');
  }
}
