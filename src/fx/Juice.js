import { CONFIG, PALETTE, VIEW } from '../config.js';
import { canvasTex, text, star } from '../art/Tex.js';
import { Save } from '../save/Save.js';

// Hit-stop, slow motion, shake, flashes, sparks, damage numbers, haptics.
export class Juice {
  constructor(scene) {
    this.scene = scene;
    this.stopLeft = 0;
    this.slowLeft = 0;
    this.slowScale = 1;

    canvasTex(scene, 'spark', 12, 12, (ctx) => {
      const g = ctx.createRadialGradient(6, 6, 0, 6, 6, 6);
      g.addColorStop(0, '#fffbe6');
      g.addColorStop(0.4, '#f6d061');
      g.addColorStop(1, 'rgba(217,169,51,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 12, 12);
    });
    canvasTex(scene, 'ember', 10, 10, (ctx) => {
      const g = ctx.createRadialGradient(5, 5, 0, 5, 5, 5);
      g.addColorStop(0, '#ffe2c2');
      g.addColorStop(0.5, '#c8361f');
      g.addColorStop(1, 'rgba(200,54,31,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 10, 10);
    });
    canvasTex(scene, 'clashstar', 90, 90, (ctx) => {
      star(ctx, 45, 45, 8, 44, 10);
      ctx.fillStyle = 'rgba(255,246,207,0.95)';
      ctx.fill();
    });

    const sparkCfg = {
      lifespan: { min: 220, max: 520 },
      speed: { min: 180, max: 620 },
      scale: { start: 1.6 / VIEW.RES, end: 0 },
      gravityY: 900,
      blendMode: 'ADD',
      emitting: false,
    };
    this.sparks = scene.add.particles(0, 0, 'spark', sparkCfg).setDepth(25);
    this.embers = scene.add.particles(0, 0, 'ember', { ...sparkCfg, speed: { min: 80, max: 300 } }).setDepth(25);

    // Full-screen flash layers.
    this.redFlash = scene.add.rectangle(VIEW.W / 2, VIEW.H / 2, VIEW.W + 400, VIEW.H + 400, PALETTE.vermilion, 0)
      .setDepth(45);
    this.goldFlash = scene.add.rectangle(VIEW.W / 2, VIEW.H / 2, VIEW.W + 400, VIEW.H + 400, 0xfff2c0, 0)
      .setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
  }

  // Combined time scale for combat logic and tweens.
  scale() {
    if (this.stopLeft > 0) return 0;
    if (this.slowLeft > 0) return this.slowScale;
    return 1;
  }

  update(realDelta) {
    if (this.stopLeft > 0) this.stopLeft -= realDelta;
    else if (this.slowLeft > 0) this.slowLeft -= realDelta;
  }

  hitStop(ms) {
    this.stopLeft = Math.max(this.stopLeft, ms);
  }

  slowMo(scale = CONFIG.juice.slowMoScale, ms = CONFIG.juice.slowMoMs) {
    this.slowScale = scale;
    this.slowLeft = ms;
  }

  shake({ ms, intensity }) {
    this.scene.cameras.main.shake(ms, intensity);
  }

  // Tint every image in a container white for a moment.
  flash(container) {
    if (container.flash) {
      container.flash(CONFIG.juice.flashMs);
      return;
    }
    const imgs = [];
    const walk = (c) => c.list.forEach((o) => (o.list ? walk(o) : o.setTintFill && imgs.push(o)));
    walk(container);
    imgs.forEach((o) => o.setTintFill(0xffffff));
    this.scene.time.delayedCall(CONFIG.juice.flashMs, () => imgs.forEach((o) => o.active && o.clearTint()));
  }

  screenFlash(kind = 'red', alpha = 0.35, ms = 220) {
    const r = kind === 'red' ? this.redFlash : this.goldFlash;
    r.setAlpha(alpha);
    this.scene.tweens.add({ targets: r, alpha: 0, duration: ms });
  }

  sparksAt(x, y, n = 22, kind = 'gold') {
    (kind === 'gold' ? this.sparks : this.embers).explode(n, x, y);
  }

  clash(x, y) {
    this.sparksAt(x, y, 34);
    const s = this.scene.add.image(x, y, 'clashstar').setDepth(26).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.3 / VIEW.RES);
    this.scene.tweens.add({
      targets: s, scale: 2.2 / VIEW.RES, alpha: 0, angle: 30, duration: 320, ease: 'Cubic.easeOut',
      onComplete: () => s.destroy(),
    });
  }

  damageNumber(x, y, amount, { color = PALETTE.goldLight, size = 34, label = null } = {}) {
    const t = text(this.scene, x + Phaser.Math.Between(-30, 30), y, label || String(Math.round(amount)), {
      fontSize: `${size}px`,
      fontStyle: '700',
      color,
      stroke: PALETTE.inkCss,
      strokeThickness: 6,
    }).setDepth(42);
    this.scene.tweens.add({
      targets: t,
      y: y - 90,
      alpha: { from: 1, to: 0 },
      scale: { from: 1.25, to: 0.9 },
      duration: CONFIG.juice.damageFloatMs,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  vibrate(pattern) {
    if (!Save.data.vibration) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) { /* not supported */ }
  }
}
