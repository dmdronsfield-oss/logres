import { CONFIG, VIEW } from '../config.js';
import { Fighter } from './Fighter.js';
import { buildEnemyRig } from '../art/Rig.js';
import { canvasTex, localToWorld, angFor, star, text } from '../art/Tex.js';
import { DIR_VEC } from '../input/SwipeInput.js';
import { Sfx } from '../audio/Sfx.js';

export const ES = {
  INTRO: 'Intro',
  IDLE: 'Idle',
  TELEGRAPH: 'Telegraph',
  STRIKE: 'Strike',
  GAP: 'ComboGap',
  RECOVER: 'Recover',
  PARRIED: 'Parried',
  STAGGERED: 'Staggered',
  FEINT: 'Feint',
  INTERLUDE: 'Interlude',
  LOCKED: 'Locked',
  DEFEATED: 'Defeated',
};

const rand = ([a, b]) => a + Math.random() * (b - a);

function pickWeighted(list, avoid) {
  const pool = list.length > 1 ? list.filter((c) => c !== avoid) : list;
  const total = pool.reduce((s, c) => s + (c.weight || 1), 0);
  let r = Math.random() * total;
  for (const c of pool) {
    r -= c.weight || 1;
    if (r <= 0) return c;
  }
  return pool[pool.length - 1];
}

export class Enemy extends Fighter {
  constructor(scene, def, { cycle, x, y, director }) {
    const mult = 1 + CONFIG.enemy.cycleMult * cycle;
    super(scene, Math.round(def.health * mult));
    this.def = def;
    this.dmgMult = mult;
    this.director = director;
    this.cfg = {
      idleMs: def.idleMs,
      comboGapMs: def.comboGapMs,
      feintChance: def.feintChance || 0,
      combos: def.combos,
      telegraphMult: 1,
      openLimit: def.openLimit || null,
    };
    this.phaseIdx = 0;
    // Every foe without a scripted second phase makes a last stand at 30% health.
    this.phases = def.phases || [{
      atHealth: 0.3, generic: true, message: `${def.name} fights on, desperate!`, telegraphMult: 0.88,
      idleMs: def.idleMs.map((x) => Math.round(x * 0.7)), comboGapMs: def.comboGapMs.map((x) => Math.round(x * 0.8)),
    }];
    this.pendingPhase = null;
    this.stagger = 0;
    this.script = [];        // forced combos (tutorial): { seq, recoverMs }
    this.hold = false;       // when true, stays idle
    this.lastCombo = null;

    this.baseX = x;
    this.baseY = y;
    this.size = (def.size || 1) * 0.9;
    // The scene may supply a different rig builder (the 3D view does).
    this.rig = (scene.rigFactory?.enemy || buildEnemyRig)(scene, def);
    this.rig.root.setPosition(x, y).setScale(this.size);

    canvasTex(scene, 'glint_gold', 64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,252,230,1)');
      g.addColorStop(0.3, 'rgba(246,208,97,0.9)');
      g.addColorStop(1, 'rgba(217,169,51,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      star(ctx, 32, 32, 4, 31, 4);
      ctx.fillStyle = 'rgba(255,255,240,0.95)';
      ctx.fill();
    });
    canvasTex(scene, 'glint_red', 64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,230,220,1)');
      g.addColorStop(0.3, 'rgba(230,60,40,0.95)');
      g.addColorStop(1, 'rgba(200,54,31,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      star(ctx, 32, 32, 4, 31, 4);
      ctx.fillStyle = 'rgba(255,220,210,0.95)';
      ctx.fill();
    });
    canvasTex(scene, 'daze', 20, 20, (ctx) => {
      star(ctx, 10, 10, 5, 9, 4);
      ctx.fillStyle = '#f6d061';
      ctx.fill();
      ctx.strokeStyle = '#2a1d14';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    canvasTex(scene, 'aura', 200, 200, (ctx) => {
      const g = ctx.createRadialGradient(100, 100, 10, 100, 100, 100);
      g.addColorStop(0, 'rgba(140,230,110,0.7)');
      g.addColorStop(1, 'rgba(60,160,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 200, 200);
    });

    this.aura = scene.add.image(x, y - 80, 'aura').setScale(3.4 / VIEW.RES, 4.2 / VIEW.RES)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(9);
    this.glint = scene.add.image(0, 0, 'glint_gold').setBlendMode(Phaser.BlendModes.ADD).setDepth(24).setVisible(false);
    // Approach ring and path arrow: when and which way the blow will come.
    this.ring = scene.add.graphics().setDepth(24);
    this.dazeStars = [0, 1, 2].map(() => scene.add.image(0, 0, 'daze').setScale(1 / VIEW.RES).setDepth(23).setVisible(false));

    this.state = ES.INTRO;
    this.t = 0;
    // The 3D hall gives him a proper entrance: walk in, then his challenge.
    this.introMs = scene.w3 ? 2700 : 900;
    this.tauntDone = false;
    this.swayT = Math.random() * 1000;
    this.pose('guard', 1);
    // Walk in from the distance.
    this.rig.root.setScale(this.size * 0.75).setAlpha(0);
    scene.tweens.add({ targets: this.rig.root, scale: this.size, alpha: 1, duration: this.introMs > 900 ? 1300 : 800, ease: 'Cubic.easeOut' });
  }

  // Objects that slide with the world when the player dodges.
  get worldObjects() {
    return [this.rig.root, this.aura];
  }

  // ---------------- poses ----------------

  _tw(target, props, ms, ease) {
    this.scene.tweens.killTweensOf(target);
    if (ms <= 1) {
      Object.assign(target, props);
      return;
    }
    this.scene.tweens.add({ targets: target, ...props, duration: ms, ease });
  }

  _apply(spec, ms, ease = 'Sine.easeInOut') {
    const r = this.rig;
    if (spec.body) this._tw(r.body, spec.body, ms, ease);
    if (spec.armR !== undefined) this._tw(r.armR, { angle: spec.armR }, ms, ease);
    if (spec.weapon !== undefined) this._tw(r.weapon, { angle: spec.weapon }, ms, ease);
    if (spec.armL !== undefined) this._tw(r.armL, { angle: spec.armL }, ms, ease);
    if (spec.head !== undefined) this._tw(r.head, { angle: spec.head }, ms, ease);
    if (spec.root) {
      const rp = { x: this.baseX + (spec.root.x || 0), y: this.baseY + (spec.root.y || 0), scale: this.size * (spec.root.scale || 1) };
      this._tw(r.root, rp, ms, ease);
    }
  }

  pose(name, ms = 200, attack = null) {
    switch (name) {
      case 'guard':
        this._apply({
          body: { angle: 0, x: 0, y: 0 }, armR: 28, weapon: -168, armL: -14, head: 0, root: {},
        }, ms);
        break;
      case 'windup': {
        if (attack.direction === 'T') {
          this._apply({
            body: { angle: -5, x: 0, y: -6 }, armR: 12, weapon: -110, armL: -30, head: -4, root: { scale: 0.95, y: -6 },
          }, ms, 'Sine.easeOut');
        } else {
          const [dx, dy] = DIR_VEC[attack.direction];
          // Downward blows cock the weapon behind the head so it stays on screen.
          const COCKED = { S: [135, 135], SE: [125, 110], SW: [-160, 70] };
          const cocked = COCKED[attack.direction];
          const vx = -dx;
          const vy = -dy - 0.4 * (1 - Math.abs(dy));
          this._apply({
            body: { angle: -dx * 7, x: -dx * 10, y: -8 },
            armR: cocked ? cocked[0] : angFor(vx, vy),
            weapon: cocked ? cocked[1] : -dx * 25,
            armL: -30,
            head: -dx * 4,
            root: {},
          }, ms, 'Sine.easeOut');
        }
        break;
      }
      case 'strike': {
        if (attack.direction === 'T') {
          this._apply({
            body: { angle: 6, x: 10, y: 14 }, armR: -38, weapon: -32, armL: -10, head: 4, root: { scale: 1.16, y: 34 },
          }, ms, 'Quad.easeIn');
        } else {
          const [dx, dy] = DIR_VEC[attack.direction];
          this._apply({
            body: { angle: dx * 8, x: dx * 14, y: 12 },
            armR: angFor(dx, dy + 0.35),
            weapon: 0,
            armL: -6,
            head: dx * 4,
            root: { scale: 1.04, y: 10 },
          }, ms, 'Quad.easeIn');
        }
        break;
      }
      case 'open':
        this._apply({
          body: { angle: Phaser.Math.Between(-6, 6), x: 0, y: 18 }, armR: 10, weapon: 12, armL: 32, head: 8, root: { scale: 0.98 },
        }, ms);
        break;
      case 'recoil':
        this._apply({
          body: { angle: -10, x: -8, y: 6 }, armR: 150, weapon: 40, armL: 40, head: -12, root: { scale: 0.96, y: -4 },
        }, ms, 'Back.easeOut');
        break;
      case 'staggered':
        this._apply({
          body: { angle: 12, x: 6, y: 40 }, armR: 4, weapon: 30, armL: 44, head: 18, root: { scale: 0.97, y: 6 },
        }, ms, 'Back.easeOut');
        break;
      case 'roar':
        this._apply({
          body: { angle: 0, x: 0, y: -14 }, armR: 120, weapon: -10, armL: -120, head: -10, root: { scale: 1.06 },
        }, ms, 'Back.easeOut');
        break;
      case 'fall':
        this._apply({
          body: { angle: 78, x: 40, y: 120 }, armR: 70, weapon: 60, armL: 60, head: 30, root: { y: 40 },
        }, ms, 'Quad.easeIn');
        break;
      default:
        break;
    }
  }

  // ---------------- state machine ----------------

  setState(s) {
    this.state = s;
    this.t = 0;
  }

  isOpen() {
    return this.state === ES.RECOVER || this.state === ES.PARRIED || this.state === ES.STAGGERED;
  }

  canBeStaggered() {
    return this.state !== ES.STAGGERED && this.state !== ES.DEFEATED && this.state !== ES.INTERLUDE && this.state !== ES.INTRO;
  }

  // Wind-up progress in ms with any hesitation removed (the ring and the pose pause together).
  visualT() {
    const h = this.attack && this.attack.hesitate;
    if (!h || this.state !== ES.TELEGRAPH) return this.t;
    const at = (this.telegraphTotal - h[1]) * h[0];
    if (this.t < at) return this.t;
    if (this.t < at + h[1]) return at;
    return this.t - h[1];
  }

  visualTotal() {
    const h = this.attack && this.attack.hesitate;
    return this.telegraphTotal - (h ? h[1] : 0);
  }

  telegraphRemaining() {
    return this.state === ES.TELEGRAPH ? this.telegraphTotal - this.t : Infinity;
  }

  inParryWindow() {
    const rem = this.telegraphRemaining();
    return rem <= CONFIG.parry.windowMs && rem > 0 && !this.feintAt;
  }

  openFraction() {
    if (!this.isOpen()) return 0;
    return Math.max(0, 1 - this.t / this.openDur);
  }

  damageTakenMult() {
    if (this.state !== ES.STAGGERED) return 1;
    return this.superStagger ? CONFIG.super.damageMult : CONFIG.stagger.damageMult;
  }

  update(dt) {
    this.t += dt;
    this.swayT += dt;
    const sway = this.state === ES.IDLE || this.state === ES.INTRO ? 1 : this.state === ES.STAGGERED ? 2.5 : 0.3;
    this.rig.root.angle = Math.sin(this.swayT / 520) * 1.4 * sway;

    switch (this.state) {
      case ES.INTRO:
        if (!this.tauntDone && this.introMs > 900 && this.t >= this.introMs * 0.52) {
          this.tauntDone = true;
          this._tauntSound();
        }
        if (this.t >= this.introMs) {
          // Make sure the walk-in finished even if its tween was starved of frames.
          this.scene.tweens.killTweensOf(this.rig.root);
          this.rig.root.setAlpha(1).setScale(this.size);
          this.toIdle();
        }
        break;
      case ES.IDLE:
        this.stanceT -= dt;
        if (this.stanceT <= 0) this.shiftGuard();
        if (!this.hold && this.t >= this.idleDur) this.startCombo();
        break;
      case ES.TELEGRAPH: {
        if (this.feintAt && this.t >= this.feintAt) {
          this.doFeint();
          break;
        }
        const rem = this.telegraphTotal - this.t;
        if (!this.windowOpened && rem <= CONFIG.parry.windowMs && !this.feintAt) {
          this.windowOpened = true;
          if (this.attack.parryable) Sfx.windowOpen();
        }
        this._updateGlint(rem);
        if (!this.released && rem <= 90 && !this.feintAt) {
          this.released = true;
          Sfx.whoosh(!!this.attack.heavy);
        }
        if (rem <= 0) this.impact();
        break;
      }
      case ES.STRIKE:
        if (this.t >= CONFIG.enemy.strikeMs + CONFIG.enemy.strikeHoldMs) this.afterStrike();
        break;
      case ES.GAP:
        if (this.t >= this.gapDur) this.telegraph(this.comboIdx + 1);
        break;
      case ES.RECOVER:
      case ES.PARRIED:
        if (this.t >= this.openDur) this.toIdle();
        break;
      case ES.STAGGERED:
        this._updateDaze();
        if (this.t >= this.openDur) {
          this.dazeStars.forEach((s) => s.setVisible(false));
          this.toIdle();
        }
        break;
      case ES.FEINT:
        if (this.t >= CONFIG.enemy.feintRecoverMs) this.startCombo(true);
        break;
      case ES.INTERLUDE:
        this.aura.setAlpha(0.5 + Math.sin(this.t / 90) * 0.25);
        if (this.t >= CONFIG.enemy.phaseInterludeMs) this.toIdle();
        break;
      default:
        break;
    }
    if (this.phaseIdx > 0 && this.state !== ES.INTERLUDE && this.state !== ES.DEFEATED) {
      this.aura.setAlpha(0.3 + Math.sin(this.swayT / 300) * 0.12);
    }
  }

  // High guard (open to horizontal cuts) or low guard (open to vertical cuts).
  // The Green Knight's axe has no such guard.
  get usesStances() {
    return this.def.weapon !== 'greataxe';
  }

  gapDirs() {
    if (!this.usesStances || this.state !== ES.IDLE) return [];
    return this.stance === 'high' ? ['E', 'W'] : ['S', 'N'];
  }

  shiftGuard(to) {
    this.stance = to || (this.stance === 'high' ? 'low' : 'high');
    this.stanceT = CONFIG.guard.shiftMs[0] + Math.random() * (CONFIG.guard.shiftMs[1] - CONFIG.guard.shiftMs[0]);
  }

  // A cut found the gap: he adapts and comes at you sooner.
  gapStruck() {
    this.shiftGuard();
    this.idleDur = Math.min(this.idleDur, this.t + CONFIG.guard.hurryMs);
  }

  toIdle() {
    if (this.pendingPhase) {
      this.enterPhase(this.pendingPhase);
      return;
    }
    this.setState(ES.IDLE);
    this.gloating = false;
    this.shiftGuard(Math.random() < 0.5 ? 'high' : 'low');
    this.superStagger = false;
    this.idleDur = this.forceShortIdle ? 250 : rand(this.cfg.idleMs);
    this.forceShortIdle = false;
    this.pose('guard', 260);
  }

  startCombo(afterFeint = false) {
    let seq;
    this.scriptRecover = null;
    if (this.script.length) {
      const s = this.script.shift();
      seq = s.seq;
      this.scriptRecover = s.recoverMs || null;
      this.scripted = true;
    } else {
      const c = pickWeighted(this.cfg.combos, this.lastCombo);
      this.lastCombo = c;
      seq = c.seq;
      this.scripted = false;
    }
    this.combo = seq.map((id) => ({ id, ...this.def.attacks[id] }));
    this.afterFeint = afterFeint;
    this.telegraph(0);
  }

  telegraph(i) {
    this.comboIdx = i;
    this.attack = this.combo[i];
    this.telegraphTotal = this.attack.telegraphMs * this.cfg.telegraphMult + (this.attack.hesitate ? this.attack.hesitate[1] : 0);
    this.setState(ES.TELEGRAPH);
    this.windowOpened = false;
    this.released = false;
    this.feintAt = null;
    if (!this.scripted && !this.afterFeint && i === 0 && Math.random() < this.cfg.feintChance) {
      const latest = this.telegraphTotal - CONFIG.parry.windowMs - 90;
      this.feintAt = Math.min(latest, this.telegraphTotal * (0.45 + Math.random() * 0.2));
    }
    this.pose('windup', Math.min(this.telegraphTotal * 0.55, 380), this.attack);
    const red = !this.attack.parryable;
    this.glint.setTexture(red ? 'glint_red' : 'glint_gold').setVisible(true).setAlpha(0);
    this.rig.setWeaponTint(red ? 0xff7a6a : null);
    Sfx.glint(red);
    this.director.onTelegraph?.(this.attack);
  }

  _tip() {
    return this.rig.tip ? this.rig.tip(1) : localToWorld(this.rig.weapon, 0, this.rig.weaponLen);
  }

  _updateGlint(rem) {
    const p = this._tip();
    const g = this.glint;
    g.setPosition(p.x, p.y);
    const win = CONFIG.parry.windowMs;
    const intro = Math.min(1, this.t / 140);
    let s = 0.7 + Math.sin(this.t / 45) * 0.12;
    if (rem <= win && !this.feintAt) s = 1.5 + (1 - rem / win) * 0.6;
    g.setAlpha(intro);
    g.setScale((s * 1.3) / VIEW.RES);
    g.angle += 4;
    this._drawRing(p, rem, intro);
  }

  // A ring closes on the glint and lands on it at the moment of impact; it turns
  // white while the parry window is open. An arrow shows the blade's path.
  _drawRing(p, rem, intro) {
    const r = this.ring;
    r.clear();
    const a = this.attack;
    const total = this.visualTotal();
    const win = CONFIG.parry.windowMs;
    const k = Math.max(0, Math.min(1, 1 - this.visualT() / total));
    // While he hesitates the ring stalls and flickers.
    if (this.visualT() !== this.t && a.hesitate && this.t < this.visualT() + a.hesitate[1]) intro *= 0.45 + 0.55 * Math.abs(Math.sin(this.t / 70));
    const red = !a.parryable;
    const inWin = rem <= win && !this.feintAt && a.parryable;
    const col = red ? 0xe0503a : inWin ? 0xffffff : 0xf6d061;
    const R0 = 18;
    const R = R0 + 92 * k;
    if (a.parryable) {
      r.lineStyle(2, 0xffffff, 0.3 * intro);
      r.strokeCircle(p.x, p.y, R0 + 92 * (win / total));
    }
    if (red) {
      // Unparryable: a dashed ring and a cross, so shape tells it apart as well as colour.
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2 + this.t / 400;
        const a1 = a0 + (Math.PI * 2 / n) * 0.55;
        r.lineStyle(5, 0x1a1008, 0.35 * intro);
        r.beginPath(); r.arc(p.x, p.y, R + 1, a0, a1); r.strokePath();
        r.lineStyle(3.5, col, 0.95 * intro);
        r.beginPath(); r.arc(p.x, p.y, R, a0, a1); r.strokePath();
      }
      const cx = p.x + R * 0.72 + 10;
      const cy = p.y - R * 0.72 - 10;
      r.lineStyle(6, 0x1a1008, 0.5 * intro);
      r.lineBetween(cx - 8, cy - 8, cx + 8, cy + 8); r.lineBetween(cx + 8, cy - 8, cx - 8, cy + 8);
      r.lineStyle(3.5, col, intro);
      r.lineBetween(cx - 8, cy - 8, cx + 8, cy + 8); r.lineBetween(cx + 8, cy - 8, cx - 8, cy + 8);
    } else {
      r.lineStyle(inWin ? 6 : 3, 0x1a1008, 0.35 * intro);
      r.strokeCircle(p.x, p.y, R + 1);
      r.lineStyle(inWin ? 5 : 3, col, 0.95 * intro);
      r.strokeCircle(p.x, p.y, R);
    }
    // Path of the blow.
    const [dx, dy] = a.direction === 'T' ? [0, 0] : DIR_VEC[a.direction];
    // Tags for blows with a rule of their own.
    const tag = a.unblockable ? 'DODGE!' : a.direction === 'T' ? 'NO DODGE' : '';
    if (tag) {
      if (!this.tagText) {
        this.tagText = text(this.scene, 0, 0, '', {
          fontSize: '15px', fontStyle: '700', color: '#ffffff', stroke: '#2a1d14', strokeThickness: 4,
        }).setDepth(24);
      }
      this.tagText.setText(tag).setColor(a.unblockable ? '#ff8a70' : '#fff3c4').setPosition(p.x, p.y + R + 26).setAlpha(intro).setVisible(true);
    } else if (this.tagText) this.tagText.setVisible(false);
    if (a.direction === 'T') {
      for (let i = 0; i < 4; i++) {
        const ang = i * Math.PI / 2 + Math.PI / 4;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        r.lineStyle(4, col, 0.9 * intro);
        r.lineBetween(p.x + c * (R + 18), p.y + s * (R + 18), p.x + c * (R + 4), p.y + s * (R + 4));
      }
      return;
    }
    const L = 150;
    const al = (inWin ? 0.95 : 0.55) * intro;
    const sx = p.x + dx * (R0 + 8);
    const sy = p.y + dy * (R0 + 8);
    const ex = p.x + dx * (R0 + L);
    const ey = p.y + dy * (R0 + L);
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6;
      const t1 = t0 + 0.6 / 6;
      r.lineStyle(5, 0x1a1008, al * 0.4);
      r.lineBetween(sx + (ex - sx) * t0, sy + (ey - sy) * t0, sx + (ex - sx) * t1, sy + (ey - sy) * t1);
      r.lineStyle(3, col, al);
      r.lineBetween(sx + (ex - sx) * t0, sy + (ey - sy) * t0, sx + (ex - sx) * t1, sy + (ey - sy) * t1);
    }
    const px = -dy;
    const py = dx;
    r.fillStyle(col, al);
    r.fillTriangle(ex + dx * 16, ey + dy * 16, ex + px * 11, ey + py * 11, ex - px * 11, ey - py * 11);
  }

  _clearRing() {
    this.ring.clear();
    if (this.tagText) this.tagText.setVisible(false);
  }

  impact() {
    this._clearRing();
    this.glint.setVisible(false);
    this.rig.setWeaponTint(null);
    this.setState(ES.STRIKE);
    this.pose('strike', CONFIG.enemy.strikeMs, this.attack);
    this.lastOutcome = this.director.resolveImpact(this.attack);
  }

  // Two of his blows landed in a row: he gloats (his challenge), and is open while he does.
  gloat() {
    this.gloatPending = false;
    this.attacksSinceGloat = 0;
    this.setState(ES.RECOVER);
    this.openDur = 1150;
    this.gloating = true;
    this.cuts = 0;
    this.director.onOpen?.();
    this.director.onGloat?.();
  }

  afterStrike() {
    this.attacksSinceGloat = (this.attacksSinceGloat ?? 3) + 1;
    if (this.gloatPending && !this.scripted && this.comboIdx + 1 >= this.combo.length) {
      if (this.attacksSinceGloat >= 3) { this.gloat(); return; }
      this.gloatPending = false;
    }
    // A perfect dodge or perfect block breaks the combo and leaves him open.
    if (!this.scripted && (this.lastOutcome === 'perfect' || this.lastOutcome === 'perfectBlock')) {
      this.cuts = 0;
      this.setState(ES.PARRIED);
      this.openDur = CONFIG.counter.openMs;
      this.countered = true;
      this.pose('recoil', 160);
      this.director.onOpen?.();
      this.director.onCounter?.();
      return;
    }
    if (this.comboIdx + 1 < this.combo.length) {
      this.setState(ES.GAP);
      this.gapDur = rand(this.cfg.comboGapMs);
      this.pose('guard', Math.min(this.gapDur, 200));
    } else {
      this.recover(this.scriptRecover || this.attack.recoverMs);
    }
  }

  // Cuts taken in the current opening, against his limit (if he has one).
  get openWarn() {
    const L = this.cfg.openLimit;
    return !!L && this.isOpen() && this.state !== ES.STAGGERED && (this.cuts || 0) >= L.cuts - 1;
  }

  limitReached() {
    const L = this.cfg.openLimit;
    return !!L && this.state !== ES.STAGGERED && (this.cuts || 0) >= L.cuts;
  }

  // He won't stand for more: slip away, or turn the blade and answer.
  recoverEarly() {
    const L = this.cfg.openLimit;
    this.cuts = 0;
    this.hopAt = performance.now();
    if (L.react === 'counter') {
      this.flinchAt = performance.now();
      this.counterCut();
    } else {
      this.toIdle();
      this.idleDur = Math.min(this.idleDur, 450);
    }
    return L.react;
  }

  recover(ms) {
    this.cuts = 0;
    this.setState(ES.RECOVER);
    this.openDur = ms;
    this.pose('open', 220);
    this.director.onOpen?.();
  }

  doFeint() {
    this.feintAt = null;
    this._clearRing();
    this.glint.setVisible(false);
    this.rig.setWeaponTint(null);
    this.setState(ES.FEINT);
    this.pose('guard', 200);
    const p = this.rig.root;
    const t = text(this.scene, p.x, p.y - 260 * this.size, 'Feint!', {
      fontSize: '24px', fontStyle: '700', color: '#f6dc8a', stroke: '#2a1d14', strokeThickness: 5,
    }).setDepth(41);
    this.scene.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  _tauntSound() {
    const k = this.def.taunt;
    const t = this.scene.time;
    if (k === 'bang') [0, 260, 520].forEach((d) => t.delayedCall(d, () => Sfx.block()));
    else if (k === 'salute') Sfx.windowOpen();
    else if (k === 'raise') Sfx.glint(false);
    else if (k === 'laugh') Sfx.laugh();
    t.delayedCall(250, () => Sfx.cheer());
  }

  // Blades bound together (a last-instant parry); the director runs the struggle.
  lock() {
    this._clearRing();
    this.glint.setVisible(false);
    this.rig.setWeaponTint(null);
    this.setState(ES.LOCKED);
  }

  counterCut() {
    // His quickest dodgeable, parryable blow, sped up.
    const opts = Object.entries(this.def.attacks).filter(([, a]) => a.parryable && a.dodge.length && !a.hesitate);
    const [id, a] = opts.sort((x, y) => x[1].telegraphMs - y[1].telegraphMs)[0] || Object.entries(this.def.attacks)[0];
    this.combo = [{ id, ...a, telegraphMs: Math.min(a.telegraphMs, 460) / this.cfg.telegraphMult, counter: true }];
    this.scripted = false;
    this.afterFeint = true;   // no feint on a counter
    this.telegraph(0);
    this.director.onEnemyCounter?.();
  }

  // Red Knight: wait out an early dodge, then strike.
  delayStrike(newRemaining) {
    if (this.state !== ES.TELEGRAPH) return;
    this.feintAt = null;
    this.telegraphTotal = this.t + newRemaining;
    this.windowOpened = false;
    this.released = false;
  }

  parried() {
    this.cuts = 0;
    this.countered = false;
    this._clearRing();
    this.glint.setVisible(false);
    this.rig.setWeaponTint(null);
    this.setState(ES.PARRIED);
    this.openDur = CONFIG.parriedOpenMs;
    this.pose('recoil', 160);
    this.director.onOpen?.();
  }

  forceStagger(ms, superFlag) {
    this.cuts = 0;
    this._clearRing();
    this.glint.setVisible(false);
    this.rig.setWeaponTint(null);
    this.setState(ES.STAGGERED);
    this.openDur = ms;
    this.superStagger = superFlag;
    this.stagger = 0;
    this.pose('staggered', 240);
    this.dazeStars.forEach((s) => s.setVisible(true));
    this.director.onOpen?.();
  }

  _updateDaze() {
    const head = this.rig.headPoint ? this.rig.headPoint() : localToWorld(this.rig.head, 0, -60);
    this.dazeStars.forEach((s, i) => {
      const a = this.t / 220 + (i * Math.PI * 2) / 3;
      s.setPosition(head.x + Math.cos(a) * 46, head.y + Math.sin(a) * 12);
      s.setDepth(Math.sin(a) > 0 ? 23 : 8);
    });
  }

  // Blocked your blow: weapon snaps into guard. Two clangs in quick succession
  // and he answers with a fast counter-cut.
  guardFlinch() {
    const now = performance.now();
    this.flinchAt = now;
    this.clangs = (this.clangs || []).filter((t) => now - t < 1200);
    this.clangs.push(now);
    if (this.clangs.length >= 2 && (this.state === ES.IDLE || this.state === ES.GAP || this.state === ES.FEINT) && !this.hold) {
      this.clangs = [];
      this.counterCut();
      return this.rig.tip ? this.rig.tip(0.5) : localToWorld(this.rig.weapon, 0, this.rig.weaponLen * 0.5);
    }
    if (this.state === ES.IDLE || this.state === ES.GAP || this.state === ES.FEINT) {
      this._apply({ armR: 40, weapon: -150 }, 60, 'Quad.easeOut');
      this.scene.time.delayedCall(120, () => {
        if (this.state === ES.IDLE) this.pose('guard', 160);
      });
    }
    return this.rig.tip ? this.rig.tip(0.5) : localToWorld(this.rig.weapon, 0, this.rig.weaponLen * 0.5);
  }

  takeHit(amount, dir) {
    const dead = this.applyDamage(amount);
    const [dx, dy] = DIR_VEC[dir] || [0, 0];
    const root = this.rig.root;
    this.scene.tweens.add({
      targets: root, x: this.baseX + dx * 14, duration: 50, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => { root.x = this.baseX; },
    });
    this.scene.tweens.add({ targets: this.rig.head, angle: this.rig.head.angle + dx * 8 + dy * 4, duration: 60, yoyo: true });
    if (dead) {
      this.defeat();
      return true;
    }
    const phases = this.phases;
    const next = phases[this.phaseIdx];
    if (next && !this.pendingPhase && this.healthFrac <= next.atHealth) this.pendingPhase = next;
    return false;
  }

  enterPhase(ph) {
    this.pendingPhase = null;
    this.phaseIdx += 1;
    Object.assign(this.cfg, {
      telegraphMult: ph.telegraphMult ?? this.cfg.telegraphMult,
      idleMs: ph.idleMs ?? this.cfg.idleMs,
      comboGapMs: ph.comboGapMs ?? this.cfg.comboGapMs,
      feintChance: ph.feintChance ?? this.cfg.feintChance,
      combos: ph.combos ?? this.cfg.combos,
      openLimit: ph.openLimit ?? this.cfg.openLimit,
    });
    this.setState(ES.INTERLUDE);
    this.pose('roar', 300);
    if (ph.generic) Sfx.stagger();
    else Sfx.laugh();
    this.director.onPhase?.(ph);
  }

  defeat() {
    this.setState(ES.DEFEATED);
    this._clearRing();
    this.glint.setVisible(false);
    this.dazeStars.forEach((s) => s.setVisible(false));
    this.scene.tweens.add({ targets: this.aura, alpha: 0, duration: 400 });
    this.pose('fall', 1100);
    // The Green Knight gets up again, laughing, before he goes (Sir Gawain and the Green Knight).
    this.rises = this.def.id === 'green';
    this.scene.tweens.add({ targets: this.rig.root, alpha: 0.0, delay: this.rises ? 3600 : 1400, duration: 900 });
  }
}
