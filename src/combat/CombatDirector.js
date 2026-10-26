import { CONFIG, PALETTE, VIEW } from '../config.js';
import { ES } from './Enemy.js';
import { PS } from './Player.js';
import { DIR_VEC, opposite, dirDistance } from '../input/SwipeInput.js';
import { Sfx } from '../audio/Sfx.js';
import { Save } from '../save/Save.js';
import { Music } from '../audio/Music.js';
import { desktopLikely } from '../input/Keys.js';

// Lessons in touch or keyboard wording.
const KEYS = desktopLikely();
const say = (touch, keys) => (KEYS ? keys : touch);

const GAWAIN_VOICE = { f0: 118, vowel: 'u' };

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
    this.stats = { parries: 0, blocks: 0, dodges: 0, hits: 0, combos: 0, taken: 0, chains: 0, breaks: 0, clashes: 0 };
  }

  // ---------- player input ----------

  onSwipe(dir) {
    if (this.over) return;
    if (this.lock) { this.lockTap(); return; }
    const p = this.player;
    const e = this.enemy;
    if (!p.canSwing()) {
      // One clean cut at a time: a swipe made late in a swing (or during a dodge) follows on;
      // earlier extra swipes, and any made while off balance, are dropped.
      const late = p.state === PS.ATTACKING && p.swingElapsed >= CONFIG.player.attackMs - CONFIG.swipe.bufferMs;
      if (late || p.state === PS.DODGING) this.buffered = { dir, at: this.clock || 0 };
      // Swiping again early in a cut rushes the next one: it bites less.
      else if (p.state === PS.ATTACKING) this.rushed = true;
      return;
    }
    this.buffered = null;
    p.swing(dir);
    Sfx.swipe();

    if (e.state === ES.TELEGRAPH && e.inParryWindow() && e.attack.parryable && this.parryMatches(dir, e.attack)) {
      if (!this.tutorial && e.telegraphRemaining() <= CONFIG.lock.lastMs) this.startLock(e.attack);
      else this.doParry();
      return;
    }
    // Anything else lands when the blade reaches him.
    this.pendingCut = { dir, left: CONFIG.player.contactMs };
  }

  // The blade arrives: a cut if he's open, through the gap in his guard, or it rings off it.
  _landCut(dir) {
    const p = this.player;
    const e = this.enemy;
    if (this.over || e.state === ES.DEFEATED) return;
    if (e.isOpen() && e.limitReached()) {
      // He won't stand for it.
      const how = e.recoverEarly();
      Sfx.clang();
      p.clangAt = performance.now();
      this.hud.hideHint();
      this.hud.callout(how === 'counter' ? 'He turns your blade' : 'He slips away', how === 'counter' ? 'bad' : 'warn');
      this._teach('limitHint', 'Some foes won\'t stand for it: when the gold glow FLICKERS, stop cutting before he recovers.', 1, true);
    } else if (e.isOpen()) {
      this.doHit(dir);
      e.cuts = (e.cuts || 0) + 1;
    } else if (!this.tutorial?.step || this.tutorial.step === 'free' ? e.gapDirs().includes(dir) : false) {
      this.doGapHit(dir);
    } else {
      const at = e.guardFlinch();
      p.clangAt = performance.now();
      Sfx.clang();
      this.juice.sparksAt(at.x, at.y, 8);
      this.tutorial?.onClang?.(dir);
      // Flailing at his guard throws you off balance (not while the tutorial is teaching).
      if (!this.tutorial || this.tutorial.step === 'free') {
        p.offBalance(CONFIG.player.offBalanceMs);
        this.hud.callout('Off balance', 'bad');
        this._teach('flailHint', 'Cutting at his guard throws you OFF BALANCE: you can\'t dodge or block for a moment. Wait for him to open.', 1, true);
      }
    }
  }

  parryMatches(dir, attack) {
    const targets = attack.parryDirs || [opposite(attack.direction)];
    return targets.some((t) => dirDistance(dir, t) <= CONFIG.parry.angleSteps);
  }

  onDodge(side) {
    if (this.over) return;
    if (this.lock) { this.lockTap(); return; }
    const p = this.player;
    if (!p.startDodge(side)) return;
    Sfx.dodge();
    Sfx.scuff();
    this.scene.dodgeShift(side);
    const e = this.enemy;
    // Punish an early dodge by waiting it out.
    if (e.def.punishEarlyDodge && e.state === ES.TELEGRAPH) {
      const rem = e.telegraphRemaining();
      if (rem > CONFIG.dodge.perfectMs + 60 && rem <= CONFIG.dodge.durationMs + 40) {
        e.delayStrike(CONFIG.dodge.durationMs + CONFIG.enemy.earlyDodgeDelayMs);
        this.hud.callout('Too soon', 'bad');
      }
    }
    this.tutorial?.onDodge?.(side);
  }

  onBlock(held) {
    if (this.over) return;
    if (this.lock) { if (held) this.lockTap(); return; }
    this.player.setBlock(held);
    this.tutorial?.onBlock?.(held);
  }

  onSuper() {
    if (this.over) return;
    if (this.lock) { this.lockTap(); return; }
    const e = this.enemy;
    if (this.superMeter < CONFIG.super.max) return;
    if (e.state === ES.DEFEATED || e.state === ES.INTRO || e.state === ES.INTERLUDE) return;
    this.superMeter = 0;
    // A short cinematic: he raises the blazing sword, then brings it down.
    this.superFx = { at: performance.now() };
    e.forceStagger(CONFIG.super.staggerMs + 600, true);
    this.juice.slowMo(0.4, 900);
    this.hud.callout('Strike of the Pendragon!', 'good', { big: true });
    Sfx.glint(false);
    Sfx.roar();
    this.scene.time.delayedCall(560, () => {
      const c = e.rig.chestPoint ? e.rig.chestPoint() : { x: VIEW.W / 2, y: VIEW.H * 0.45 };
      Sfx.superBurst();
      Sfx.stagger();
      this.juice.screenFlash('gold', 0.7, 500);
      this.juice.shake(CONFIG.juice.shakeHeavy);
      this.juice.sparksAt(c.x, c.y, 50);
      this.juice.sparksAlong(c.x, c.y - 40, 0, 1, 30);
    });
  }

  // ---------- blade lock ----------

  startLock(attack) {
    const e = this.enemy;
    const tip = e._tip();
    this.lock = { v: 0.5, t: 0, last: performance.now(), attack };
    e.lock();
    this.player.setBlock(false);
    this.juice.hitStop(140);
    this.juice.parryBurst(tip.x, tip.y, 1.3);
    this.juice.shake(CONFIG.juice.shakeTaken);
    this.juice.vibrate(CONFIG.juice.vibrateParryMs);
    Sfx.clashHeavy();
    this.hud.callout('Blade lock!', 'good', { big: true });
    this.hud.showLock(true);
    Music.play('stand');
    this._teach('lockHint', 'BLADE LOCK! Tap fast, anywhere (or any key), to drive him back!', 1, true);
  }

  lockTap() {
    const L = this.lock;
    if (!L || L.done) return;
    L.v = Math.min(1, L.v + CONFIG.lock.tapPush);
    L.taps = (L.taps || 0) + 1;
    Sfx.clang();
    if (L.taps % 4 === 1) Sfx.scrape();
    const tip = this.enemy._tip();
    this.juice.sparksAt(tip.x, tip.y, 6);
    this.hud.pulseLock();
  }

  _updateLock(realDt) {
    const L = this.lock;
    const dt = Math.min(50, realDt || 16.7);
    if (L.done || this.juice.stopLeft > 0) return;
    L.t += dt;
    L.v -= (CONFIG.lock.pushPerSec * (this.enemy.def.lockPush || 1) * this.enemy.dmgMult * dt) / 1000;
    this.hud.setLock(L.v);
    if (L.v >= 1 || (L.t >= CONFIG.lock.maxMs && L.v >= 0.5)) this._endLock(true);
    else if (L.v <= 0 || L.t >= CONFIG.lock.maxMs) this._endLock(false);
  }

  _endLock(won) {
    const L = this.lock;
    L.done = true;
    this.lock = null;
    this.hud.showLock(false);
    const e = this.enemy;
    Music.play(e.phaseIdx > 0 ? 'stand' : e.def.id === 'green' ? 'boss' : 'duel');
    if (won) Sfx.cheer();
    const p = this.player;
    if (won) {
      this.stats.locks = (this.stats.locks || 0) + 1;
      e.forceStagger(CONFIG.lock.winStaggerMs, false);
      this.juice.hitStop(120);
      this.juice.screenFlash('gold', 0.4, 300);
      this.juice.shake(CONFIG.juice.shakeHeavy);
      Sfx.stagger();
      this.hud.callout('Overpowered!', 'good', { big: true });
      this.addSuper(15);
    } else {
      const dmg = Math.round(L.attack.damage * e.dmgMult * CONFIG.lock.loseDamage);
      this.stats.taken += dmg;
      e.toIdle();
      Sfx.hurt();
      this.juice.screenFlash('red', 0.4, 260);
      this.juice.shake(CONFIG.juice.shakeTaken);
      this.hud.callout('Forced down!', 'bad', { big: true });
      if (p.takeHit(dmg)) this.playerDefeated();
    }
  }

  // ---------- habits: he reads you ----------

  // The player's last five answers to his blows.
  noteAnswer(kind) {
    const h = this.habits || (this.habits = []);
    h.push(kind);
    if (h.length > 5) h.shift();
  }

  // A habit is one answer in 4 of the last 5 ('dodge:left', 'dodge:right', 'block', 'parry').
  habit() {
    const h = this.habits || [];
    if (h.length < 5) return null;
    const counts = {};
    h.forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
    return Object.keys(counts).find((k) => counts[k] >= 4) || null;
  }

  // He has picked an attack to beat the habit: call it out, so it's fair.
  onRead(kind) {
    this.habits = [];
    const what = kind === 'block' ? 'shield' : kind === 'parry' ? 'parry' : 'dodge';
    this.hud.callout(`He reads your ${what}!`, 'warn');
    Sfx.jeer();
    this._teach('readHint', 'He has READ your habit and will strike where it fails. Vary your answers: dodge both ways, block, parry.', 1, true);
  }

  // ---------- outcomes ----------

  // A parry. The burst, sound and meter gains are the same wherever it falls in his combination;
  // what follows depends on the chain (brief 33): inside it, a clash and he fights on; on the last
  // blow, the ordinary parried opening, or the Break if every blow of the chain was answered.
  doParry() {
    const e = this.enemy;
    const tip = e._tip();
    this.stats.parries += 1;
    this.noteAnswer('parry');
    e.noteParry();
    this.juice.hitStop(CONFIG.juice.parryStopMs);
    this.juice.slowMo(CONFIG.juice.parrySlowScale, CONFIG.juice.parrySlowMs);
    this.juice.parryBurst(tip.x, tip.y);
    this.juice.shake(CONFIG.juice.shakeHit);
    this.juice.vibrate(CONFIG.juice.vibrateParryMs);
    Sfx.parry();
    Sfx.cheer();
    this.hud.callout('Parry');
    this.addSuper(CONFIG.super.fromParry);
    this.addStagger(CONFIG.stagger.fromParry);
    // Three parries in a row, inside a chain or across chains, strike the weapon from his hand.
    this.parryRun = (this.parryRun || 0) + 1;
    if (e.state === ES.STAGGERED) {
      // The parry filled his stagger meter: the stagger takes over, and the parry count carries on.
      this.onChainEnd();
    } else if (this.parryRun >= CONFIG.disarm.parries && !this.tutorial) {
      this.doDisarm();
    } else if (!e.lastBlow) {
      // A clash: he is held back a beat, then the chain goes on. No riposte, and he is not open.
      this.stats.clashes += 1;
      e.clashed();
    } else {
      // The chain ends on the parry: a Break if every blow was answered (never in the tutorial's
      // scripted lessons), else the ordinary parried opening. The riposte arrow shows either way
      // and applies to the first cut.
      this.onChainEnd();
      if (!e.scripted && e.chainAnswered) e.breakOpen(true);
      else e.parried();
      const back = e.attack.direction === 'T' ? 'S' : e.attack.direction;
      this.riposte = { dir: back, until: performance.now() + e.openDur };
      this.hud.showHint(back, 'riposte');
      this._teach('ripHint', say('RIPOSTE: swipe the way the white chevron flashed, for double damage.', 'RIPOSTE: press the arrow the white chevron flashed, for double damage.'), 1, true);
    }
    this.tutorial?.onParry?.();
  }

  doDisarm() {
    const e = this.enemy;
    this.parryRun = 0;
    this.onChainEnd();   // his weapon is gone: the chain is over, wherever it was
    this.riposte = null;
    this.hud.hideHint();
    e.disarm(CONFIG.disarm.openMs);
    this.stats.disarms = (this.stats.disarms || 0) + 1;
    this.hud.callout('Disarmed!', 'good', { big: true });
    this.juice.slowMo(0.3, 380);
    Sfx.cheer();
    this.scene.time.delayedCall(820, () => Sfx.clatter());
    this._teach('disarmHint', 'DISARMED! Three parries in a row struck the blade from his hand. Cut him down before he takes it up!', 1, true);
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
    // Timed cut: the first cut of an opening, landed the moment he opens.
    const rushed = this.rushed && !riposte;
    this.rushed = false;
    if (rushed) {
      mult *= CONFIG.player.rushedMult;
      this.stats.rushed = (this.stats.rushed || 0) + 1;
      this.hud.callout('Rushed', 'bad');
      this._teach('rushHint', 'Swiping again before your cut has finished RUSHES the next one: it bites less. One clean cut at a time.', 2);
    }
    const timed = !riposte && !rushed && this.openSeq.length === 0 && (this.clock || 0) - (this.openedAt ?? -1e9) <= CONFIG.player.timedCutMs;
    if (timed) {
      mult *= CONFIG.player.timedCutMult;
      this.stats.timed = (this.stats.timed || 0) + 1;
      this.hud.callout('Timed cut');
      this._teach('timedHint', 'TIMED CUT! Strike the instant he opens for extra damage. Be ready, not mid-swing.', 2);
    }
    const dmg = Math.round(p.damage * mult);
    this.stats.hits += 1;
    if (riposte) {
      this.stats.ripostes = (this.stats.ripostes || 0) + 1;
      this.hud.callout('Riposte');
      this.juice.hitStop(CONFIG.juice.comboStopMs);
      this.juice.screenFlash('gold', 0.3, 200);
    }

    const [dx, dy] = DIR_VEC[dir];
    const chest = e.rig.chestPoint
      ? e.rig.chestPoint()
      : { x: e.rig.root.x + (e.rig.root.parentContainer?.x || 0), y: e.rig.root.y - 120 * e.size };
    // Where the cut lands: high cuts across the head and shoulders, level ones across the body,
    // somewhere along the blade's line through him.
    const head = e.rig.headPoint ? e.rig.headPoint() : { x: chest.x, y: chest.y - 60 };
    const high = Math.abs(dy) > 0.6;
    const along = (Math.random() - 0.5) * 50;
    const hx = (high ? (chest.x + head.x) / 2 : chest.x) + dx * along;
    const hy = (high ? (chest.y + head.y) / 2 + 10 : chest.y + 8) + dy * along;
    this.juice.flash(e.rig.root);
    this.juice.hitStop(CONFIG.juice.hitStopMs);
    this.juice.shake(CONFIG.juice.shakeHit);
    this.juice.sparksAt(hx, hy, 8, 'red');
    this.juice.sparksAlong(hx, hy, dx, dy, 18);
    this.juice.damageNumber(hx, hy, dmg, { color: mult > 1 ? '#fff6cf' : PALETTE.goldLight, size: mult > 1 ? 24 : 19 });
    Sfx.hitArmour(e.def.armour || 'mail');
    if (Math.random() < 0.45) Sfx.voice(e.def.voice, 'pain');
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
        this.juice.damageNumber(hx, hy - 30, bonus, { color: '#ffffff', size: 28 });
        this.hud.callout(c.name, 'good', { big: true });
        this.comboHint = null;
        this.hud.hideHint();
        Sfx.combo();
        if (e.takeHit(bonus, dir)) this.enemyDefeated();
        break;
      }
    }
  }

  // A cut through the gap in his guard: half damage, no combos, and he adapts.
  doGapHit(dir) {
    const e = this.enemy;
    const p = this.player;
    const dmg = Math.round(p.damage * CONFIG.guard.gapDamage);
    this.stats.gaps = (this.stats.gaps || 0) + 1;
    e.clangs = [];
    const c = e.rig.chestPoint ? e.rig.chestPoint() : { x: VIEW.W / 2, y: VIEW.H * 0.45 };
    this.juice.flash(e.rig.root);
    this.juice.hitStop(50);
    this.juice.shake(CONFIG.juice.shakeHit);
    this.juice.sparksAt(c.x, c.y, 10, 'red');
    this.juice.damageNumber(c.x, c.y, dmg, { color: PALETTE.goldLight, size: 17 });
    this.hud.callout('Through his guard');
    Sfx.hitArmour(e.def.armour || 'mail');
    this.addSuper(CONFIG.super.fromHit);
    this.hud.hideGap();
    if (e.takeHit(dmg, dir)) { this.enemyDefeated(); return; }
    e.gapStruck();
  }

  // Called by the enemy at the moment its blow lands.
  resolveImpact(attack) {
    const p = this.player;
    const e = this.enemy;
    const tip = e._tip();
    let outcome;
    this.parryRun = 0;
    if (p.state === PS.DODGING) this.noteAnswer(`dodge:${p.dodgeSide}`);
    else if (p.state === PS.BLOCKING) this.noteAnswer('block');
    if (p.state === PS.DODGING && attack.dodge.includes(p.dodgeSide)) {
      const perfect = p.dodgeElapsed <= CONFIG.dodge.perfectMs;
      outcome = perfect ? 'perfect' : 'dodged';
      this.stats.dodges += 1;
      if (perfect) {
        this.hud.callout('Perfect dodge');
        this.juice.slowMo(0.35, 240);
        this.juice.screenFlash('gold', 0.12, 140);
        this.addStagger(CONFIG.stagger.fromPerfectDodge);
        this.addSuper(CONFIG.super.fromPerfectDodge);
      } else {
        this.addStagger(CONFIG.stagger.fromDodge);
        this.addSuper(CONFIG.super.fromDodge);
      }
    } else if (p.state === PS.BLOCKING && attack.unblockable) {
      // A shield bash goes straight through a raised shield.
      outcome = 'hit';
      const dmg = Math.round(attack.damage * e.dmgMult);
      this.stats.taken += dmg;
      const dead = p.takeHit(dmg);
      Sfx.shieldBreak();
      Sfx.hurt();
      this.juice.hitStop(CONFIG.juice.takenStopMs);
      this.juice.shake(CONFIG.juice.shakeHeavy);
      this.juice.screenFlash('red', 0.45, 260);
      this.hud.callout('Guard broken', 'bad');
      this.hitCount = 0;
      if (dead) this.playerDefeated();
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
      this.hud.callout('Perfect block');
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
      this._teach('perfectBlockHint', 'Raise the shield at the LAST instant for a perfect block: no pip spent, and his stagger meter fills twice as fast.', 2);
      if (p.pips === 0) {
        Sfx.shieldBreak();
        this.hud.callout('Shield spent', 'bad');
      }
    } else {
      outcome = 'hit';
      if (p.state === PS.BLOCKING) this.hud.callout('Shield spent', 'bad');
      const dmg = Math.round(attack.damage * e.dmgMult);
      this.stats.taken += dmg;
      const dead = p.takeHit(dmg);
      Sfx.hurt();
      Sfx.gasp();
      Sfx.voice(GAWAIN_VOICE, 'pain');
      // Pride: two of his blows in a row and he'll gloat.
      this.hitsInRow = (this.hitsInRow || 0) + 1;
      if (this.hitsInRow >= 2) { e.gloatPending = true; this.hitsInRow = 0; }
      this.juice.hitStop(CONFIG.juice.takenStopMs);
      this.juice.edgeFlash(attack.direction);
      this.juice.shake(attack.heavy ? CONFIG.juice.shakeHeavy : CONFIG.juice.shakeTaken);
      this.juice.screenFlash('red', attack.heavy ? 0.5 : 0.35, 260);
      this.juice.vibrate(CONFIG.juice.vibrateHitMs * (attack.heavy ? 2 : 1));
      this.hitCount = 0;
      if (dead) this.playerDefeated();
    }
    if (outcome !== 'hit') this.hitsInRow = 0;
    if (outcome !== 'hit' && outcome !== 'blocked') this.juice.sparksAt(tip.x, tip.y, 4);
    this.tutorial?.onImpact?.(outcome, attack);
    return outcome;
  }

  onOpen() {
    this.openSeq = [];
    this.openedAt = this.clock || 0;
    // Show the next known strike sequence, one chevron at a time (a parry shows its riposte first).
    this.comboHint = { combo: CONFIG.combos[this.comboTurn % CONFIG.combos.length], step: 0 };
    this.comboTurn += 1;
    if (!this.riposte) {
      this._showComboHint();
      if (this.hud.strikeHintsOn()) this._teach('comboHint', say('Follow the gold chevrons for a KNOWN STRIKE: a heavy bonus blow.', 'Press the arrow keys the gold chevrons show for a KNOWN STRIKE: a heavy bonus blow.'));
    }
  }

  // One-time lessons for the deeper moves, shown once the tutorial is over.
  // `after` = only on the nth time the situation arises. Urgent lessons (about the
  // blow coming now) show at once; the rest queue and wait for a quiet moment.
  _teach(flag, msg, after = 1, urgent = false) {
    if (this.tutorial && this.tutorial.step !== 'free') return;
    if (Save.data[flag]) return;
    this._seen = this._seen || {};
    this._seen[flag] = (this._seen[flag] || 0) + 1;
    if (this._seen[flag] < after) return;
    this.lessons = this.lessons || [];
    if (urgent) {
      Save.set({ [flag]: true });
      this.lessons = this.lessons.filter((l) => l.flag !== flag);
      this.hud.banner(msg, 3400);
      this.lessonAt = performance.now();
    } else if (!this.lessons.some((l) => l.flag === flag)) {
      this.lessons.push({ flag, msg });
    }
  }

  // A quiet moment: he's open, roaring, or has a while yet before his next blow.
  _nextLesson() {
    const e = this.enemy;
    const now = performance.now();
    if (!this.lessons || !this.lessons.length || now - (this.lessonAt || 0) < 4500 || this.lock) return;
    const quiet = e.isOpen() || e.state === ES.INTERLUDE || (e.state === ES.IDLE && e.idleDur - e.t > 900);
    if (!quiet) return;
    const l = this.lessons.shift();
    if (Save.data[l.flag]) return;
    Save.set({ [l.flag]: true });
    this.hud.banner(l.msg, 3400);
    this.lessonAt = now;
  }

  // He checked his swing: a word at the top, not over his head.
  onFeint() {
    this.hud.callout('Feint', 'bad');
  }

  onGloat() {
    this.hud.callout('He gloats! Strike!', 'warn');
    Sfx.jeer();
    this._teach('gloatHint', 'Land two blows on you and he GLOATS. While he does he is open: make him pay.', 1, true);
  }

  // A combination of his has run its course (for the briefs' tables: Breaks per chain).
  onChainEnd() {
    this.stats.chains += 1;
  }

  // The Break (brief 33): every blow of his combination was answered, and he is thrown open for a
  // long moment. The big centre text, as a stagger gets; the open glow is already his.
  onBreak(allParried, parriedLast) {
    this.stats.breaks += 1;
    this.hud.callout('Break!', 'good', { big: true });
    Sfx.windowOpen();
    Sfx.voice(this.enemy.def.voice, 'stagger');
    if (!parriedLast) Sfx.cheer();   // a parry on the last blow has just had its cheer
    this._teach('breakHint', 'BREAK! Answer every blow of his combination and he is thrown open for a long moment. Parry them all for the longest Break.', 1, true);
  }

  _showComboHint() {
    const h = this.comboHint;
    if (!h) return;
    this.hud.showHint(h.combo.seq[h.step], 'combo');
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

  onEnemyCounter() {
    this.hud.callout('His counter', 'bad');
    this._teach('spamHint', 'Striking at his guard only clangs, and he answers. Strike when he is OPEN.');
  }

  onTelegraph(attack) {
    this.tutorial?.onTelegraph?.(attack);
    if (this.tutorial && this.tutorial.step !== 'free') return;
    if (attack.bash) this._teach('bashHint', 'SHIELD BASH! It cannot be parried or blocked. DODGE it!', 1, true);
    if (attack.hesitate) this._teach('hesitateHint', 'He HESITATES at the top of his blow. Wait for it to fall.', 1, true);
    // One-time explanations for attack types the tutorial doesn't cover.
    if (!attack.parryable && !attack.unblockable && !Save.data.redHintShown) {
      Save.set({ redHintShown: true });
      this.hud.banner('A RED glint cannot be parried. Dodge it or block it!', 3200);
    } else if (attack.direction === 'T' && !Save.data.thrustHintShown) {
      Save.set({ thrustHintShown: true });
      this.hud.banner(say('A THRUST cannot be dodged. Block it, or swipe sideways to parry!', 'A THRUST cannot be dodged. Block it (S), or press ← or → to parry!'), 3400);
    }
  }

  onPhase(ph) {
    if (!Save.data.standSeen) Save.set({ standSeen: true });
    Music.play('stand');
    Sfx.cheer();
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
      Sfx.voice(e.def.voice, 'stagger');
      this.juice.shake(CONFIG.juice.shakeTaken);
      this.hud.callout('Staggered!', 'good', { big: true });
      this.tutorial?.onStagger?.();
    }
  }

  addSuper(n) {
    const was = this.superMeter;
    this.superMeter = Math.min(CONFIG.super.max, this.superMeter + n);
    if (was < CONFIG.super.max && this.superMeter >= CONFIG.super.max && !Save.data.superHintShown) {
      Save.set({ superHintShown: true });
      this.hud.banner(say('Your SUPER is ready: tap the glowing star to stun him.', 'Your SUPER is ready: press W (or Enter) to stun him.'), 3200);
    }
  }

  // The finishing blow: slow motion while the camera swings round, the galleries
  // roar and throw roses. The Green Knight, as in the poem, will not stay down.
  enemyDefeated() {
    if (this.over) return;
    this.over = true;
    const green = this.enemy.def.id === 'green';
    this.finisher = { at: performance.now(), green };
    this.juice.hitStop(160);
    this.juice.slowMo(0.22, 1700);
    // The killing blow lands in a white flash (after Infinity Blade).
    this.juice.screenFlash('white', 0.8, 650);
    this.juice.shake(CONFIG.juice.shakeHeavy);
    this.hud.cinematic(true);
    this.hud.hideHint();
    this.hud.hideBanner(true);
    Sfx.defeat();
    const t = this.scene.time;
    t.delayedCall(420, () => Sfx.roar());
    t.delayedCall(650, () => this.juice.petals());
    t.delayedCall(1500, () => this.hud.bigText(green ? 'The Green Knight rises…' : 'Victory', PALETTE.goldLight, 200, green ? 44 : 64));
    if (green) {
      t.delayedCall(2100, () => Sfx.laugh());
      t.delayedCall(2400, () => this.hud.banner('“Seek me at the Green Chapel, Sir Gawain, a twelvemonth and a day from now!”', 2600));
    }
    t.delayedCall(green ? 5200 : 3400, () => this.scene.endDuel(true));
  }

  // Your fall: slow motion, the HUD clears, the camera comes round to face you.
  playerDefeated() {
    if (this.over) return;
    this.over = true;
    this.fallen = { at: performance.now() };
    this.juice.slowMo(0.3, 1500);
    this.hud.cinematic(true);
    this.hud.hideHint();
    this.hud.hideGap();
    this.hud.hideBanner(true);
    if (this.lock) { this.lock = null; this.hud.showLock(false); }
    Sfx.defeat();
    Sfx.gasp();
    Music.play('silence');
    this.scene.time.delayedCall(900, () => this.hud.bigText('You fall…', '#ff9a85', 220, 56));
    this.scene.time.delayedCall(2800, () => this.scene.endDuel(false));
  }

  update(realDt) {
    const e = this.enemy;
    const p = this.player;
    this.clock = (this.clock || 0) + realDt;   // real time, ms (also steps with the test harness)
    if (!this.over) this._nextLesson();
    if (this.lock) this._updateLock(realDt);
    if (this.pendingCut) {
      this.pendingCut.left -= realDt;
      if (this.pendingCut.left <= 0) {
        const { dir } = this.pendingCut;
        this.pendingCut = null;
        this._landCut(dir);
      }
    }
    if (this.buffered) {
      // Kept for the rest of the swing (allowing for slow motion), then played at once.
      if ((this.clock || 0) - this.buffered.at > CONFIG.swipe.bufferMs + 300) this.buffered = null;
      else if (p.canSwing()) this.onSwipe(this.buffered.dir);
    }
    // The gap in his guard, while he waits (a faint arrow; taught once).
    const gaps = this.over || (this.tutorial && this.tutorial.step !== 'free') ? [] : e.gapDirs();
    if (gaps.length) {
      const c = e.rig.chestPoint ? e.rig.chestPoint() : { x: VIEW.W / 2, y: VIEW.H * 0.45 };
      this.hud.showGap(e.stance, c.x, c.y);
      if (e.t > 600) this._teach('gapHint', 'Between his attacks, watch his guard: a faint arrow shows the GAP. Cut through it for a quick strike.');
    } else this.hud.hideGap();
    if (!e.isOpen() || this.over) {
      if (this.comboHint || this.riposte) this.hud.hideHint();
      this.comboHint = null;
      this.riposte = null;
    } else {
      const c = e.rig.chestPoint ? e.rig.chestPoint() : { x: VIEW.W / 2, y: VIEW.H * 0.45 };
      this.hud.placeHint(c.x, c.y);
    }
    this.hud.set({
      alert: e.state === ES.TELEGRAPH || e.state === ES.STRIKE || e.state === ES.GAP || e.state === ES.CLASH,
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
