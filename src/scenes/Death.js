import { desktopLikely } from '../input/Keys.js';
import { VIEW, PALETTE, CONFIG } from '../config.js';
import { Save } from '../save/Save.js';
import { Sfx } from '../audio/Sfx.js';
import { ENEMIES } from '../combat/enemies.js';
import { img, text, canvasTex } from '../art/Tex.js';
import { backgroundKey } from '../art/Backgrounds.js';
import { drawShieldShape } from '../art/Rig.js';
import { setupCamera, fadeTo, py } from './common.js';
import { Music } from '../audio/Music.js';

// Bloodline succession: the fallen knight's shield hangs in the chapel.
export class Death extends Phaser.Scene {
  constructor() {
    super('Death');
  }

  create(data) {
    this._leaving = false;
    setupCamera(this);
    const W = VIEW.W;
    const H = VIEW.H;
    const def = ENEMIES.find((e) => e.id === data.enemyId) || ENEMIES[0];
    const s = Save.data;
    const shield = CONFIG.shields.find((x) => x.id === data.shield) || CONFIG.shields[0];

    img(this, W / 2, H / 2, backgroundKey(this, 'chapelInterior'));

    // The hung shield, with its cord and nail.
    const key = `hung_${shield.id}`;
    canvasTex(this, key, 200, 240, (ctx) => {
      ctx.beginPath();
      ctx.moveTo(100, 12);
      ctx.lineTo(40, 70);
      ctx.moveTo(100, 12);
      ctx.lineTo(160, 70);
      ctx.strokeStyle = '#c9a66b';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(100, 12, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#555';
      ctx.fill();
      drawShieldShape(ctx, shield.id === 'targe' ? 'round' : 'heater', 100, 130, 68, shield.field, shield.charge);
    });
    const hung = img(this, W / 2, py(96, 0.45), key, 0.5, 0.05);
    hung.setAngle(-6);
    this.tweens.add({ targets: hung, angle: 4, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Candles
    const flames = [];
    (VIEW.portrait ? [-200, -150, 150, 200] : [-250, -170, 170, 250]).forEach((dx) => {
      const x = W / 2 + dx;
      this.add.rectangle(x, py(300, 0.45), 16, 60, 0xf1e3c4).setStrokeStyle(2, PALETTE.ink);
      const f = this.add.ellipse(x, py(260, 0.45), 12, 22, 0xf6d061).setBlendMode(Phaser.BlendModes.ADD);
      flames.push(f);
    });
    this.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => flames.forEach((f) => f.setScale(0.85 + Math.random() * 0.3, 0.85 + Math.random() * 0.35)),
    });

    text(this, W / 2, py(50, 0.45), `Generation ${data.fallenGen} fell before ${def.name}.`, {
      fontSize: '22px', color: PALETTE.parchmentCss, stroke: PALETTE.inkCss, strokeThickness: 5, wordWrap: { width: W - 60 }, align: 'center',
    });
    const oath = text(this, W / 2, py(392, 0.45), `The oath passes to his son.\nGeneration ${s.generation}.`, {
      fontSize: '32px', fontStyle: '700', color: PALETTE.goldLight, stroke: PALETTE.inkCss, strokeThickness: 7, lineSpacing: 6,
    }).setAlpha(0);
    this.tweens.add({ targets: oath, alpha: 1, delay: 900, duration: 900 });

    const extra = [`+${data.xp} experience carried in the blood`];
    if (data.levels > 0) extra.push(`Level ${s.level}`);
    (data.unlocks || []).forEach((u) => extra.push(`New gear: ${u}`));
    text(this, W / 2, py(468, 0.45), extra.join(' · '), {
      fontSize: '16px', color: PALETTE.parchmentCss, stroke: PALETTE.inkCss, strokeThickness: 4, wordWrap: { width: W - 60 }, align: 'center',
    });

    const tap = text(this, W / 2, H - 30, desktopLikely() ? 'Press Enter to take up the sword' : 'Tap to take up the sword', {
      fontSize: '18px', color: '#f6dc8a', stroke: PALETTE.inkCss, strokeThickness: 4,
    }).setAlpha(0);
    this.tweens.add({ targets: tap, alpha: 1, delay: 1800, duration: 500 });
    this.tweens.add({ targets: tap, alpha: 0.4, delay: 2400, duration: 900, yoyo: true, repeat: -1 });

    this.time.delayedCall(1600, () => {
      const go = () => { Sfx.click(); fadeTo(this, 'Title'); };
      this.input.once('pointerup', go);
      const onKey = (e) => { if (['Enter', 'Space', 'Escape', 'NumpadEnter'].includes(e.code)) go(); };
      window.addEventListener('keydown', onKey);
      this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
    });

    Music.play('silence');
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.time.delayedCall(400, () => Sfx.bell());
  }
}
