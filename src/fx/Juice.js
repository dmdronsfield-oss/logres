import { CONFIG, PALETTE, VIEW } from '../config.js';
import { canvasTex, text } from '../art/Tex.js';
import { Save } from '../save/Save.js';
import { comfort } from '../ui/Comfort.js';

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

    // The parry burst (after Infinity Blade): a white core with blue-white spikes,
    // then thin speed lines running out from the point where the blades met.
    canvasTex(scene, 'parrystar', 220, 220, (ctx) => {
      const c = 110;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + (i % 2) * 0.2;
        const len = i % 2 ? 78 : 106;
        const w = i % 2 ? 7 : 10;
        const g = ctx.createLinearGradient(c, c, c + Math.cos(a) * len, c + Math.sin(a) * len);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.5, 'rgba(190,225,255,0.85)');
        g.addColorStop(1, 'rgba(150,200,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a + Math.PI / 2) * w, c + Math.sin(a + Math.PI / 2) * w);
        ctx.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len);
        ctx.lineTo(c + Math.cos(a - Math.PI / 2) * w, c + Math.sin(a - Math.PI / 2) * w);
        ctx.closePath();
        ctx.fill();
      }
      const core = ctx.createRadialGradient(c, c, 0, c, c, 46);
      core.addColorStop(0, 'rgba(255,255,255,1)');
      core.addColorStop(0.45, 'rgba(225,240,255,0.9)');
      core.addColorStop(1, 'rgba(170,210,255,0)');
      ctx.fillStyle = core;
      ctx.fillRect(c - 46, c - 46, 92, 92);
    });
    canvasTex(scene, 'speedline', 96, 4, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 96, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 1, 96, 2);
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

    // Rose petals and gold leaf from the galleries (the finishing blow).
    canvasTex(scene, 'petal', 16, 12, (ctx) => {
      ctx.beginPath();
      ctx.ellipse(8, 6, 7, 4.5, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#b8142a';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(6.5, 5, 3.5, 2, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,120,130,0.55)';
      ctx.fill();
    });
    canvasTex(scene, 'leaf', 8, 8, (ctx) => {
      ctx.fillStyle = '#f6d061';
      ctx.fillRect(1, 1, 6, 6);
    });

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
    if (comfort()) return;
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
    if (comfort()) alpha = Math.min(alpha, 0.12);
    if (kind === 'white' && !this.whiteFlash) {
      this.whiteFlash = this.scene.add.rectangle(VIEW.W / 2, VIEW.H / 2, VIEW.W + 400, VIEW.H + 400, 0xffffff, 0).setDepth(this.goldFlash.depth);
    }
    const r = kind === 'red' ? this.redFlash : kind === 'white' ? this.whiteFlash : this.goldFlash;
    r.setAlpha(alpha);
    this.scene.tweens.add({ targets: r, alpha: 0, duration: ms });
  }

  sparksAt(x, y, n = 22, kind = 'gold') {
    (kind === 'gold' ? this.sparks : this.embers).explode(n, x, y);
  }

  // Sparks sprayed along a cut's direction (dx, dy) from where it lands.
  sparksAlong(x, y, dx, dy, n = 16) {
    if (!this.cutSparks) {
      this.cutSparks = this.scene.add.particles(0, 0, 'spark', {
        lifespan: { min: 180, max: 420 }, speed: { min: 260, max: 760 }, scale: { start: 1.5 / VIEW.RES, end: 0 },
        gravityY: 700, blendMode: 'ADD', emitting: false,
      }).setDepth(25);
    }
    const a = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
    this.cutSparks.setEmitterAngle({ min: a - 28, max: a + 28 });
    this.cutSparks.explode(n, x, y);
  }

  // Parry: a burst at the point of contact, then speed lines from it.
  parryBurst(x, y, big = 1) {
    const R = VIEW.RES;
    const calm = comfort();
    this.sparksAt(x, y, 14);
    const s = this.scene.add.image(x, y, 'parrystar').setDepth(26).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.35 / R).setAngle(Math.random() * 360).setAlpha(calm ? 0.55 : 1);
    this.scene.tweens.add({ targets: s, scale: (1.25 * big) / R, duration: 90, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({ targets: s, alpha: 0, delay: 110, duration: 170, onComplete: () => s.destroy() });
    if (calm) return;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const r0 = (36 + Math.random() * 20) / R;
      const r1 = ((230 + Math.random() * 90) * big) / R;
      const l = this.scene.add.image(x + Math.cos(a) * r0, y + Math.sin(a) * r0, 'speedline').setDepth(26)
        .setBlendMode(Phaser.BlendModes.ADD).setOrigin(0, 0.5).setRotation(a).setScale(1 / R, 1 / R).setAlpha(0);
      this.scene.tweens.add({
        targets: l, x: x + Math.cos(a) * r1, y: y + Math.sin(a) * r1, scaleX: 2.4 / R, alpha: { from: 1, to: 0 },
        delay: 90, duration: 280, ease: 'Quad.easeOut', onComplete: () => l.destroy(),
      });
    }
  }

  // A red flash on the edge of the screen a blow came from (its direction of travel
  // points away from that edge; overheads come from the top, thrusts from all round).
  edgeFlash(direction) {
    const W = VIEW.W;
    const H = VIEW.H;
    if (!this.scene.textures.exists('edgeGrad')) {
      canvasTex(this.scene, 'edgeGrad', 64, 8, (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 64, 0);
        g.addColorStop(0, 'rgba(220,30,20,0.9)');
        g.addColorStop(1, 'rgba(220,30,20,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 8);
      });
    }
    const from = { E: ['L'], W: ['R'], S: ['T'], SE: ['L', 'T'], SW: ['R', 'T'], N: ['B'], NE: ['L'], NW: ['R'], T: ['L', 'R', 'T'] }[direction] || ['T'];
    const depth = Math.min(W, H) * 0.22;
    from.forEach((side) => {
      const im = this.scene.add.image(0, 0, 'edgeGrad').setDepth(46).setBlendMode(Phaser.BlendModes.ADD).setAlpha(comfort() ? 0.45 : 1);
      if (side === 'L') im.setOrigin(0, 0.5).setPosition(0, H / 2).setDisplaySize(depth, H);
      if (side === 'R') im.setOrigin(0, 0.5).setPosition(W, H / 2).setAngle(180).setDisplaySize(depth, H);
      if (side === 'T') im.setOrigin(0, 0.5).setPosition(W / 2, 0).setAngle(90).setDisplaySize(depth, W);
      if (side === 'B') im.setOrigin(0, 0.5).setPosition(W / 2, H).setAngle(-90).setDisplaySize(depth, W);
      this.scene.time.delayedCall(30, () => this.scene.tweens.add({ targets: im, alpha: 0, duration: 520, onComplete: () => im.destroy() }));
    });
  }

  petals(ms = 2200) {
    const W = VIEW.W;
    const mk = (key, scale, qty) => this.scene.add.particles(0, 0, key, {
      x: { min: -20, max: W + 20 }, y: -20, lifespan: 5200,
      speedY: { min: 70, max: 170 }, speedX: { min: -50, max: 50 }, accelerationX: { min: -30, max: 30 },
      rotate: { start: 0, end: 540 }, scale: { min: scale * 0.7, max: scale * 1.3 }, alpha: { start: 1, end: 0.6 },
      quantity: qty, frequency: 40,
    }).setDepth(43);
    const roses = mk('petal', 1.3 / VIEW.RES, 2);
    const gold = mk('leaf', 1 / VIEW.RES, 1);
    this.scene.time.delayedCall(ms, () => { roses.stop(); gold.stop(); });
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
    // Browsers refuse (and log) vibration before the first tap; keyboard players never tap.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) { /* not supported */ }
  }
}
