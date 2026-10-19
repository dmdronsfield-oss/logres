import { VIEW, PALETTE } from '../config.js';
import { Save } from '../save/Save.js';
import { Sfx } from '../audio/Sfx.js';
import { ENEMIES } from '../combat/enemies.js';
import { img, text } from '../art/Tex.js';
import { backgroundKey } from '../art/Backgrounds.js';
import { menuButton } from '../ui/Button.js';
import { bindMenuKeys } from '../input/Keys.js';
import { Music } from '../audio/Music.js';
import { setupCamera, fadeTo, py } from './common.js';

export class Victory extends Phaser.Scene {
  constructor() {
    super('Victory');
  }

  create(data) {
    this._leaving = false;
    setupCamera(this);
    const W = VIEW.W;
    const H = VIEW.H;
    const def = ENEMIES.find((e) => e.id === data.enemyId) || ENEMIES[0];
    const s = Save.data;

    const bgKey = backgroundKey(this, def.scene);
    img(this, W / 2, H / 2, bgKey).setAlpha(0.5);
    this.events.once('shutdown', () => { if (this.textures.exists(bgKey)) this.textures.remove(bgKey); });
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a1410, 0.35);

    const P = VIEW.portrait;
    const title = text(this, W / 2, py(80, 0.42), data.final ? 'The Cycle Turns' : 'Victory', {
      fontSize: '64px', fontStyle: '700', color: PALETTE.goldLight, stroke: PALETTE.inkCss, strokeThickness: 10,
    }).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 500, ease: 'Back.easeOut' });

    const lines = [];
    if (data.final) {
      lines.push(`${def.name} bows his head. Your line is written into the chronicles.`);
      lines.push(`Generation ${s.generation} rides out against foes grown stronger.`);
    } else {
      lines.push(`${def.name} is beaten.`);
    }
    const st = data.stats || {};
    lines.push(`Parries ${st.parries || 0} · Ripostes ${st.ripostes || 0} · Dodges ${st.dodges || 0}${P ? '\n' : ' · '}Blocks ${st.blocks || 0} · Strikes ${st.hits || 0}`);
    lines.push(`+${data.xp} experience`);
    if (data.levels > 0) lines.push(`Level up! You are now level ${s.level}: more health and a keener edge.`);
    (data.unlocks || []).forEach((u) => lines.push(`New gear: ${u}. Choose it in camp.`));

    let ly = py(160, 0.42);
    lines.forEach((l, i) => {
      const t = text(this, W / 2, ly, l, {
        fontSize: i === 0 ? '24px' : '19px', color: PALETTE.parchmentCss, stroke: PALETTE.inkCss, strokeThickness: 5,
        fontStyle: i === 0 ? '700' : '400', wordWrap: { width: W - (VIEW.portrait ? 70 : 160) }, align: 'center',
      }).setAlpha(0);
      ly += Math.max(38, t.height + 12);
      this.tweens.add({ targets: t, alpha: 1, delay: 300 + i * 220, duration: 300 });
    });

    // XP bar
    const g = this.add.graphics();
    const bw = 360;
    const by = ly - 10;
    g.fillStyle(PALETTE.ink, 0.85).fillRoundedRect(W / 2 - bw / 2 - 4, by - 4, bw + 8, 16, 5);
    g.fillStyle(PALETTE.lapis, 1).fillRect(W / 2 - bw / 2, by, bw * (s.xp / Save.xpToNext()), 8);

    const next = ENEMIES[s.runStage] || ENEMIES[0];
    // Upright phones stack the buttons, Onward on top, in thumb reach.
    const on = P ? { x: W / 2, y: H - 210 } : { x: W / 2 + 140, y: H - 70 };
    const camp = P ? { x: W / 2, y: H - 92 } : { x: W / 2 - 140, y: H - 70 };
    menuButton(this, on.x, on.y, P ? 320 : 260, P ? 72 : 62, `Onward`, () => fadeTo(this, 'Duel'), { size: P ? 30 : 26, fill: '#f6dc8a' });
    bindMenuKeys(this, { Enter: () => fadeTo(this, 'Duel'), Space: () => fadeTo(this, 'Duel'), Escape: () => fadeTo(this, 'Title') });
    text(this, on.x, on.y + (P ? 54 : 42), `vs ${next.name}`, { fontSize: '15px', color: PALETTE.parchmentCss, stroke: PALETTE.inkCss, strokeThickness: 4 });
    menuButton(this, camp.x, camp.y, 220, 56, 'To camp', () => fadeTo(this, 'Title'), { size: 22 });

    if (data.fromWhite) this.cameras.main.fadeIn(700, 255, 255, 255);
    else this.cameras.main.fadeIn(300, 26, 20, 16);
    Music.play('victory');
    this.time.delayedCall(200, () => Sfx.bell());
  }
}
