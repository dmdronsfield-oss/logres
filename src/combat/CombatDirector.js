import { CONFIG, PALETTE, VIEW } from '../config.js';
import { ES } from './Enemy.js';
import { PS } from './Player.js';
import { DIR_VEC, opposite, dirDistance } from '../input/SwipeInput.js';
import { Sfx } from '../audio/Sfx.js';
import { Save } from '../save/Save.js';

// Referee between the player and the enemy: applies the combat rules,
// meters, combos and feedback, and decides the outcome of the duel.
export class CombatDirector {
  constructor(scene, { player, juice, hud }) {
    this.scene = scene;
    this.player = player;
    this.juice = juice;
    this.hud = hud;
    this.enemy = null;
    this.tutorial = null;
    this.superMeter = 0;
    this.hitCount = 0;
    this.lastHitAt = 0;
    this.openSeq = [];
    this.riposte = null;      // { dir, until } after a parry
    this.comboHint = null;    // { combo, step } while he is open
    this.comboTurn = 0;
    this.over = false;
    this.stats = { parries: 0, blocks: 0, dodges: 0, hits: 0, combos: 0, taken: 0 };
  }

  // ---------- player input ----------

  onSwipe(dir) {
    if (this.over) return;
    const p = this.player;
    const e = this.enemy;
    if (!p.canSwing()) {
      // Keep a swipe made during hit-stop or slow motion and play it as soon as the arm is free.
      this.buffered = { dir, at: performance.now() };
      return;
    }
    this.buffered = null;
    p.swing(dir);
    Sfx.swipe();

    if (e.state === ES.TELEGRAPH && e.inParryWindow() && e.attack.parryable && this.parryMatches(dir, e.attack)) {
      this.doParry();
    } else if (e.isOpen()) {
      this.doHit(dir);
    } else if (e.state !== ES.DEFEATED) {
      const at = e.guardFlinch();
      p.clangAt = performance.now();
      Sfx.clang();
      this.juice.sparksAt(at.x, at.y, 8);
      this.tutorial?.onClang?.(dir);
    }
  }

  parryMatches(dir, attack) {
    const targets = attack.parryDirs || [opposite(attack.direction)];
    return targets.some((t) => dirDistance(dir, t) <= CONFIG.parry.angleSteps);
  }

  onDodge(side) {
    if (this.over) return;
    const p = this.player;
    if (!p.startDodge(side)) return;
    Sfx.dodge();
    this.scene.dodgeShift(side);
    const e = this.enemy;
    // Punish an early dodge by waiting it out.
    if (e.def.punishEarlyDodge && e.state === ES.TELEGRAPH) {
      const rem = e.telegraphRemaining();
      if (rem > CONFIG.dodge.perfectMs + 60 && rem <= CONFIG.dodge.durationMs + 40) {
        e.delayStrike(CONFIG.dodge.durationMs + CONFIG.enemy.earlyDodgeDelayMs);
        this.hud.bigText('Too soon!', PALETTE.vermilionCss, 200, 34);
      }
    }
    this.tutorial?.onDodge?.(side);
  }

  onBlock(held) {
    if (this.over) return;
    this.player.setBlock(held);
    this.tutorial?.onBlock?.(held);
  }

  onSuper() {
    if (this.over) return;
    const e = this.enemy;
    if (this.superMeter < CONFIG.super.max) return;
    if (e.state === ES.DEFEATED || e.state === ES.INTRO || e.state === ES.INTERLUDE) return;
    this.superMeter = 0;
    e.forceStagger(CONFIG.super.staggerMs, true);
    Sfx.superBurst();
    this.juice.screenFlash('gold', 0.6, 400);
    this.juice.shake(CONFIG.juice.shakeHeavy);
    this.hud.bigText('Strike of the Pendragon!', PALETTE.goldLight, 200, 40);
  }

  // ---------- outcomes ----------

  doParry() {
    const e = this.enemy;
    const tip = e._tip();
    e.parried();
    this.stats.parries += 1;
    this.juice.hitStop(CONFIG.juice.parryStopMs);
    this.juice.slowMo(CONFIG.juice.parrySlowScale, CONFIG.juice.parrySlowMs);
    this.juice.clash(tip.x, tip.y);
    this.juice.screenFlash('gold', 0.25, 160);
    this.juice.shake(CONFIG.juice.shakeHit);
    this.juice.vibrate(CONFIG.juice.vibrateParryMs);
    Sfx.parry();
    this.hud.bigText('Parry!', PALETTE.goldLight, 200, 50);
    this.addSuper(CONFIG.super.fromParry);
    this.addStagger(CONFIG.stagger.fromParry);
    // Riposte: the return cut along his blow's own line.
    const back = e.attack.direction === 'T' ? 'S' : e.attack.direction;
    this.riposte = { dir: back, until: performance.now() + CONFIG.parriedOpenMs };
    this.hud.showHint(back, 'Riposte!', 'riposte');
    this.tutorial?.onParry?.();
  }

  doHit(dir) {
    const e = this.enemy;
    const p = this.player;
    const now = performance.now();
    this.hitCount = now - this.lastHitAt <= CONFIG.player.hitChainMs + CONFIG.player.attackMs ? this.hitCount + 1 : 1;
    this.lastHitAt = now;
    let mult = e.damageTakenMult();
    let riposte = false;
    if (this.riposte && now < this.riposte.until && dirDistance(dir, this.riposte.dir) === 0) {
      riposte = true;
      mult *= CONFIG.riposte.damageMult;
    }
    if (this.riposte) {
      this.riposte = null;
      this.hud.hideHint();
    }
    const dmg = Math.round(p.damage * mult);
    this.stats.hits += 1;
    if (riposte) {
      this.stats.ripostes = (this.stats.ripostes || 0) + 1;
      this.hud.bigText('Riposte!', '#fff6cf', 200, 46);
      this.juice.hitStop(CONFIG.juice.comboStopMs);
      this.juice.screenFlash('gold', 0.3, 200);
    }

    const [dx, dy] = DIR_VEC[dir];
    const chest = e.rig.chestPoint
      ? e.rig.chestPoint()
      : { x: e.rig.root.x + (e.rig.root.parentContainer?.x || 0), y: e.rig.root.y - 120 * e.size };
    const hx = chest.x + dx * 20;
    const hy = chest.y + dy * 30;
    this.juice.flash(e.rig.root);
    this.juice.hitStop(CONFIG.juice.hitStopMs);
    this.juice.shake(CONFIG.juice.shakeHit);
    this.juice.sparksAt(hx, hy, 14, 'red');
    this.juice.damageNumber(hx, hy - 40, dmg, { color: mult > 1 ? '#fff6cf' : PALETTE.goldLight, size: mult > 1 ? 40 : 32 });
    Sfx.hit();
    this.hud.showCounter(this.hitCount);
    this.addSuper(CONFIG.super.fromHit);
    this.tutorial?.onHit?.();

    if (e.takeHit(dmg, dir)) {
      this.enemyDefeated();
      return;
    }
    if (riposte) {
      if (e.state !== ES.STAGGERED) this.addStagger(CONFIG.riposte.stagger);
      this._nextComboHint(null);
    } else {
      this._nextComboHint(dir);
    }

    // Swipe combos within one open window.
    this.openSeq.push(dir);
    for (const c of CONFIG.combos) {
      const n = c.seq.length;
      if (this.openSeq.length >= n && c.seq.every((d, i) => this.openSeq[this.openSeq.length - n + i] === d)) {
        this.openSeq = [];
        const bonus = Math.round(c.damage * p.damageMult * mult);
        this.stats.combos += 1;
        this.juice.hitStop(CONFIG.juice.comboStopMs);
        this.juice.screenFlash('gold', 0.35, 260);
        this.juice.shake(CONFIG.juice.shakeTaken);
        this.juice.sparksAt(hx, hy, 40);
        this.juice.damageNumber(hx, hy - 90, bonus, { color: '#ffffff', size: 46 });
        this.hud.bigText(c.name, PALETTE.goldLight, 150, 42);
        this.comboHint = null;
        this.hud.hideHint();
        Sfx.combo();
        if (e.takeHit(bonus, dir)) this.enemyDefeated();
        break;
      }
    }
  }

  // Called by the enemy at the moment its blow lands.
  resolveImpact(attack) {
    const p = this.player;
    const e = this.enemy;
    const tip = e._tip();
    let outcome;
    if (p.state === PS.DODGING && attack.dodge.includes(p.dodgeSide)) {
      const perfect = p.dodgeElapsed <= CONFIG.dodge.perfectMs;
      outcome = perfect ? 'perfect' : 'dodged';
      this.stats.dodges += 1;
      if (perfect) {
        this.hud.bigText('Perfect dodge!', '#fff6cf', 200, 36);
        this.addStagger(CONFIG.stagger.fromPerfectDodge);
        this.addSuper(CONFIG.super.fromPerfectDodge);
      } else {
        this.addStagger(CONFIG.stagger.fromDodge);
        this.addSuper(CONFIG.super.fromDodge);
      }
    } else if (p.state === PS.BLOCKING && p.blockElapsed <= CONFIG.block.perfectMs) {
      // Shield raised at the last moment: turned aside cleanly, no pip spent.
      outcome = 'perfectBlock';
      this.stats.blocks += 1;
      this.stats.perfectBlocks = (this.stats.perfectBlocks || 0) + 1;
      p.blockImpact(false);
      Sfx.block();
      Sfx.windowOpen();
      this.juice.hitStop(90);
      this.juice.shake(CONFIG.juice.shakeHit);
      this.juice.screenFlash('gold', 0.2, 160);
      this.juice.sparksAt(tip.x, tip.y, 26);
      this.hud.bigText('Perfect block!', '#fff6cf', 200, 40);
      this.addStagger(CONFIG.stagger.fromPerfectBlock);
      this.addSuper(CONFIG.super.fromPerfectBlock);
    } else if (p.state === PS.BLOCKING && p.pips > 0) {
      outcome = 'blocked';
      p.blockImpact();
      this.stats.blocks += 1;
      Sfx.block();
      this.juice.shake(attack.heavy ? CONFIG.juice.shakeTaken : CONFIG.juice.shakeHit);
      this.juice.sparksAt(VIEW.W / 2, VIEW.H - 170, 10);
      this.addStagger(CONFIG.stagger.fromBlock);
      this.addSuper(CONFIG.super.fromBlock);
      if (p.pips === 0) {
        Sfx.shieldBreak();
        this.hud.bigText('Shield spent!', PALETTE.vermilionCss, 200, 36);
      }
    } else {
      outcome = 'hit';
      if (p.state === PS.BLOCKING) this.hud.bigText('Shield spent!', PALETTE.vermilionCss, 200, 36);
      const dmg = Math.round(attack.damage * e.dmgMult);
      this.stats.taken += dmg;
      const dead = p.takeHit(dmg);
      Sfx.hurt();
      this.juice.hitStop(CONFIG.juice.takenStopMs);
      this.juice.shake(attack.heavy ? CONFIG.juice.shakeHeavy : CONFIG.juice.shakeTaken);
      this.juice.screenFlash('red', attack.heavy ? 0.5 : 0.35, 260);
      this.juice.vibrate(CONFIG.juice.vibrateHitMs * (attack.heavy ? 2 : 1));
      const at = p.rig.chestPoint ? p.rig.chestPoint() : { x: VIEW.W / 2, y: VIEW.H - 200 };
      this.juice.damageNumber(at.x, at.y - 30, dmg, { color: '#ff9a85', size: 34 });
      this.hitCount = 0;
      if (dead) this.playerDefeated();
    }
    if (outcome !== 'hit' && outcome !== 'blocked') this.juice.sparksAt(tip.x, tip.y, 4);
    this.tutorial?.onImpact?.(outcome, attack);
    return outcome;
  }

  onOpen() {
    this.openSeq = [];
    // Show the next known strike sequence, one chevron at a time (a parry shows its riposte first).
    this.comboHint = { combo: CONFIG.combos[this.comboTurn % CONFIG.combos.length], step: 0 };
    this.comboTurn += 1;
    if (!this.riposte) this._showComboHint();
  }

  // A perfect dodge or perfect block broke his attack.
  onCounter() {
    this.hud.bigText('Counter!', '#fff6cf', 160, 44);
    Sfx.windowOpen();
  }

  _showComboHint() {
    const h = this.comboHint;
    if (!h) return;
    this.hud.showHint(h.combo.seq[h.step], `${h.combo.name} ${h.step + 1}/${h.combo.seq.length}`, 'combo');
  }

  _nextComboHint(dir) {
    const h = this.comboHint;
    if (!h) return;
    if (dir === null) h.step = 0;
    else if (dir === h.combo.seq[h.step]) h.step += 1;
    else h.step = dir === h.combo.seq[0] ? 1 : 0;
    if (h.step >= h.combo.seq.length) h.step = 0;
    this._showComboHint();
  }

  onTelegraph(attack) {
    this.tutorial?.onTelegraph?.(attack);
    if (this.tutorial && this.tutorial.step !== 'free') return;
    // One-time explanations for attack types the tutorial doesn't cover.
    if (!attack.parryable && !Save.data.redHintShown) {
      Save.set({ redHintShown: true });
      this.hud.banner('A RED glint cannot be parried. Dodge it or block it!', 3200);
    } else if (attack.direction === 'T' && !Save.data.thrustHintShown) {
      Save.set({ thrustHintShown: true });
      this.hud.banner('A THRUST cannot be dodged. Block it, or swipe sideways to parry!', 3400);
    }
  }

  onPhase(ph) {
    this.hud.banner(ph.message, 1600);
    this.juice.shake(CONFIG.juice.shakeHeavy);
    this.juice.screenFlash('gold', 0.3, 500);
  }

  addStagger(n) {
    const e = this.enemy;
    if (!e.canBeStaggered() && e.state !== ES.PARRIED) return;
    if (e.state === ES.STAGGERED) return;
    e.stagger += n;
    if (e.stagger >= CONFIG.stagger.max) {
      e.stagger = 0;
      e.forceStagger(CONFIG.stagger.durationMs, false);
      Sfx.stagger();
      this.juice.shake(CONFIG.juice.shakeTaken);
      this.hud.bigText('Staggered!', '#fff6cf', 200, 52);
      this.tutorial?.onStagger?.();
    }
  }

  addSuper(n) {
    const was = this.superMeter;
    this.superMeter = Math.min(CONFIG.super.max, this.superMeter + n);
    if (was < CONFIG.super.max && this.superMeter >= CONFIG.super.max && !Save.data.superHintShown) {
      Save.set({ superHintShown: true });
      this.hud.banner('Your SUPER is ready: tap the glowing star to stun him.', 3200);
    }
  }

  enemyDefeated() {
    if (this.over) return;
    this.over = true;
    this.juice.slowMo();
    this.juice.screenFlash('gold', 0.5, 600);
    this.juice.shake(CONFIG.juice.shakeHeavy);
    this.hud.bigText('Victory', PALETTE.goldLight, 200, 64);
    Sfx.defeat();
    this.scene.time.delayedCall(1900, () => this.scene.endDuel(true));
  }

  playerDefeated() {
    if (this.over) return;
    this.over = true;
    this.juice.slowMo(0.4, 700);
    Sfx.defeat();
    this.hud.bigText('You fall…', '#ff9a85', 220, 56);
    this.scene.time.delayedCall(1900, () => this.scene.endDuel(false));
  }

  update() {
    const e = this.enemy;
    const p = this.player;
    if (this.buffered) {
      if (performance.now() - this.buffered.at > CONFIG.swipe.bufferMs) this.buffered = null;
      else if (p.canSwing()) this.onSwipe(this.buffered.dir);
    }
    if (!e.isOpen() || this.over) {
      if (this.comboHint || this.riposte) this.hud.hideHint();
      this.comboHint = null;
      this.riposte = null;
    } else {
      const c = e.rig.chestPoint ? e.rig.chestPoint() : { x: VIEW.W / 2, y: VIEW.H * 0.45 };
      this.hud.placeHint(c.x, c.y);
    }
    this.hud.set({
      enemy: e.healthFrac,
      player: p.healthFrac,
      stagger: e.state === ES.STAGGERED ? e.openFraction() : e.stagger / CONFIG.stagger.max,
      open: e.openFraction(),
      superF: this.superMeter / CONFIG.super.max,
    });
    this.hud.setSuperReady(this.superMeter >= CONFIG.super.max);
    this.hud.setPips(p.pips, p.maxPips);
  }
}
