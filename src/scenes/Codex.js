import { VIEW, PALETTE } from '../config.js';
import { Save } from '../save/Save.js';
import { Sfx } from '../audio/Sfx.js';
import { Music } from '../audio/Music.js';
import { img, text, canvasTex, roundRect } from '../art/Tex.js';
import { menuButton } from '../ui/Button.js';
import { bindMenuKeys } from '../input/Keys.js';
import { setupCamera, fadeTo, abbeyBackdrop } from './common.js';

// The Book of Arms: every technique and foe's trick, with how to do or answer
// it. Entries open as you meet them in battle (the lesson flags); basics are open.
const ARTS = [
  { title: 'The Strike', open: true, text: 'Your blade only bites while he is OPEN: after his attack, when parried, or staggered. A gold shimmer shows it.', how: 'Swipe across him · arrow keys' },
  { title: 'The Dodge', open: true, text: 'Step aside AGAINST the blade\'s travel. Overheads can be dodged either way; thrusts cannot be dodged.', how: 'Left / right roundels · A / D' },
  { title: 'The Shield', open: true, text: 'Stops anything but the shield bash. Each block spends a pip; they return in time.', how: 'Hold the shield roundel · S or Space' },
  { title: 'The Parry', open: true, text: 'As the ring turns WHITE, swipe against his blow. It breaks his guard and fills his stagger.', how: 'Swipe against the blow · the opposite arrow' },
  { title: 'The Riposte', flag: 'ripHint', text: 'After a parry, a white arrow shows the return cut. Follow it for double damage.', how: 'Swipe along the white arrow' },
  { title: 'The Disarm', flag: 'disarmHint', text: 'Three parries in a row strike the weapon from his hand. He is open until he stoops to take it up.', how: 'Parry three blows in a row' },
  { title: 'The Perfect Block', flag: 'perfectBlockHint', text: 'Raise the shield at the last instant: no pip is spent, and his attack is broken.', how: 'Block just as the ring closes' },
  { title: 'The Counter', flag: 'counterHint', text: 'A perfect dodge or perfect block cuts his combination short and leaves him open.', how: 'Dodge or block at the last instant' },
  { title: 'The Timed Cut', flag: 'timedHint', text: 'The first cut that lands the instant he opens strikes half again as hard. Be ready for the opening, not mid-swing.', how: 'Cut as the gold glow appears' },
  { title: 'The Clean Cut', flag: 'rushHint', text: 'Each cut runs its course: coil, cut, follow-through. Swiping again early in a cut rushes the next one, and it bites less.', how: 'One swipe per cut' },
  { title: 'Known Strikes', open: true, text: 'Sequences of cuts in one opening for a heavy bonus blow. Gold arrows walk you through one each time he is open.', how: 'Follow the gold arrows (listed in camp)' },
  { title: 'The Gap in his Guard', flag: 'gapHint', text: 'Waiting, he holds a high guard (open to a level cut) or a low guard (open to a vertical one). A faint arrow shows the gap.', how: 'Cut through the gap: ← → or ↓ ↑' },
  { title: 'The Blade Lock', flag: 'lockHint', text: 'Parry at the very last instant and the blades bind. Drive him back and he is overpowered; fail and he forces you down.', how: 'Tap fast, anywhere · any key' },
  { title: 'Strike of the Pendragon', flag: 'superHintShown', text: 'When the star\'s ring is full, call down the strike: he is stunned and takes double damage.', how: 'Tap the star · W or Enter' },
];

const TRICKS = [
  { title: 'The Red Glint', flag: 'redHintShown', text: 'A dashed red ring cannot be parried. Dodge it, or take it on the shield.', how: 'Dodge or block' },
  { title: 'The Thrust', flag: 'thrustHintShown', text: 'Straight at you, tagged NO DODGE. Block it, or parry with a sideways swipe.', how: 'Block · swipe ← or →' },
  { title: 'The Shield Bash', flag: 'bashHint', text: 'The Saxon drives his shield at you. It goes through a raised shield and cannot be parried.', how: 'Dodge it' },
  { title: 'The Hesitation', flag: 'hesitateHint', text: 'The Black Knight stops at the top of his blow; the ring stalls and flickers. Wait for it to move.', how: 'Patience' },
  { title: 'Off Balance', flag: 'flailHint', text: 'A cut that rings off his guard throws you off balance: for a moment you can\'t dodge, block or cut.', how: 'Strike only when he is open' },
  { title: 'The Counter-cut', flag: 'spamHint', text: 'Swipe twice at his guard and he answers at once.', how: 'Strike only when he is open' },
  { title: 'Recovering Early', flag: 'limitHint', text: 'Better foes won\'t stand for many cuts: the Brigand slips away, the Red Knight turns your blade. The gold glow flickers first.', how: 'Stop when the glow flickers' },
  { title: 'He Reads You', flag: 'readHint', text: 'Answer every blow the same way and he notices. He calls it, then strikes where your habit fails: a cut from your safe side, a blow through the shield, a feint.', how: 'Vary your answers' },
  { title: 'Pride', flag: 'gloatHint', text: 'Land two blows on you in a row and he gloats. While he does, he is open.', how: 'Strike while he gloats' },
  { title: 'The Last Stand', flag: 'standSeen', text: 'Near the end every foe fights on harder: faster wind-ups, shorter pauses.', how: 'Hold your nerve' },
];

export class Codex extends Phaser.Scene {
  constructor() {
    super('Codex');
  }

  create() {
    this._leaving = false;
    setupCamera(this);
    const W = VIEW.W;
    const H = VIEW.H;
    abbeyBackdrop(this);

    const pw = Math.min(W - 50, 780);
    const top = 70;
    const bottom = H - 72;
    const key = `codex_${pw}x${bottom - top}`;
    canvasTex(this, key, pw, bottom - top + 20, (ctx, w, h) => {
      roundRect(ctx, 4, 4, w - 8, h - 8, 12);
      ctx.fillStyle = 'rgba(241,227,196,0.96)';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = PALETTE.goldCss;
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = PALETTE.inkCss;
      ctx.stroke();
    });
    img(this, W / 2, top - 10, key, 0.5, 0);
    text(this, W / 2, 38, 'The Book of Arms', {
      fontSize: '36px', fontStyle: '700', color: PALETTE.goldLight, stroke: PALETTE.inkCss, strokeThickness: 7,
    }).setDepth(11);

    // Entries, in a scrolling column masked to the page.
    const col = this.add.container(0, 0);
    const x0 = W / 2 - pw / 2 + 30;
    const wrap = pw - 60;
    let y = top + 6;
    const section = (name) => {
      col.add(text(this, W / 2, y + 14, name, { fontSize: '22px', fontStyle: '700', color: PALETTE.vermilionCss }));
      y += 38;
    };
    const entry = (e) => {
      const open = e.open || !!Save.data[e.flag];
      // Sealed entries show their name, greyed, so there's something to look for.
      const t = text(this, x0, y, open ? e.title : `${e.title} · sealed`, {
        fontSize: '19px', fontStyle: '700', color: open ? PALETTE.lapisCss : '#9a8a6a', originX: 0, originY: 0,
      });
      col.add(t);
      y += t.height + 2;
      const b = text(this, x0, y, open ? e.text : 'Not yet met in battle.', {
        fontSize: '15px', color: open ? PALETTE.inkCss : '#9a8a6a', wordWrap: { width: wrap }, originX: 0, originY: 0, lineSpacing: 2, align: 'left',
      });
      col.add(b);
      y += b.height + 2;
      if (open) {
        const hw = text(this, x0, y, `How: ${e.how}`, {
          fontSize: '14px', fontStyle: '700', color: '#7a5a20', wordWrap: { width: wrap }, originX: 0, originY: 0, align: 'left',
        });
        col.add(hw);
        y += hw.height;
      }
      y += 16;
    };
    section('Your Arts');
    ARTS.forEach(entry);
    section('Their Tricks');
    TRICKS.forEach(entry);
    // Credits for the work by others in the game (their licences ask for it).
    section('Credits');
    [
      'Knight armour: "Medieval Knight Armor (Low-poly / Rigged)" by INKXO, CC BY 4.0 (sketchfab.com).',
      'Menu music: "Wendale Abbey" by Yubatake, CC BY 4.0 (OpenGameArt.org).',
      'Everything else (art, motion, sound) is made in code for Logres.',
    ].forEach((line) => {
      const t = text(this, x0, y, line, { fontSize: '14px', color: PALETTE.inkCss, wordWrap: { width: wrap }, originX: 0, originY: 0, align: 'left' });
      col.add(t);
      y += t.height + 8;
    });
    const contentH = y - top;
    const viewH = bottom - top;
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff).fillRect(W / 2 - pw / 2, top, pw, viewH);
    col.setMask(maskShape.createGeometryMask());

    // Scrolling: drag, wheel, arrow keys.
    this.scrollY = 0;
    const maxScroll = Math.max(0, contentH - viewH + 10);
    const setScroll = (v) => {
      this.scrollY = Math.max(0, Math.min(maxScroll, v));
      col.y = -this.scrollY;
    };
    let dragY = null;
    this.input.on('pointerdown', (p) => { dragY = p.y; });
    this.input.on('pointermove', (p) => {
      if (dragY === null || !p.isDown) return;
      setScroll(this.scrollY - (p.y - dragY));
      dragY = p.y;
    });
    this.input.on('pointerup', () => { dragY = null; });
    this.input.on('wheel', (p, objs, dx, dy) => setScroll(this.scrollY + dy * 0.6));

    const close = () => { Sfx.click(); fadeTo(this, 'Title'); };
    menuButton(this, W / 2, H - 36, 200, 44, 'Close', close, { size: 20 }).setDepth(12);
    bindMenuKeys(this, {
      Escape: close, Enter: close,
      ArrowDown: () => setScroll(this.scrollY + 80), ArrowUp: () => setScroll(this.scrollY - 80),
      PageDown: () => setScroll(this.scrollY + viewH * 0.8), PageUp: () => setScroll(this.scrollY - viewH * 0.8),
    });
    Music.play('abbey');
    this.cameras.main.fadeIn(250, 26, 20, 16);
  }
}
