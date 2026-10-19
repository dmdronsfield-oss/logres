import { CONFIG } from '../config.js';
import { ES } from './Enemy.js';
import { desktopLikely } from '../input/Keys.js';

// Prompts in touch and keyboard wording.
const KEYS = desktopLikely();
const say = (touch, keys) => (KEYS ? keys : touch);

// Scripted first duel: the enemy attacks on cue and the game freezes at the
// right moment until the player performs the prompted action.
export class Tutorial {
  constructor(director, hud) {
    this.d = director;
    this.hud = hud;
    this.step = 'intro';
    this.t = 0;
    this.frozen = null;   // 'dodge' | 'block' | 'parry' while waiting for input
    this.froze = false;   // already froze on the current attack
    this.hits = 0;
    this.parryTries = 0;
    director.tutorial = this;
    hud.banner('A Saxon raider! Watch his weapon: a GOLD GLINT marks where his blow begins.', 0);
  }

  get e() {
    return this.d.enemy;
  }

  scale() {
    return this.frozen ? 0 : 1;
  }

  _queue(seq, recoverMs) {
    this.e.script.push({ seq, recoverMs });
    this.froze = false;
  }

  _go(step, msg, ms = 0, arrow = '') {
    this.step = step;
    if (msg) this.hud.banner(msg, ms, arrow);
  }

  _unfreeze() {
    this.frozen = null;
    this.hud.pulse(['dodgeL', 'dodgeR', 'block'], false);
  }

  update(realDelta) {
    this.t += realDelta;
    const e = this.e;
    if (this.step !== 'free') e.hold = e.script.length === 0;
    e.minHealth = this.step === 'free' ? 0 : Math.ceil(e.maxHealth * 0.3);

    if (this.step === 'intro' && this.t > 3200 && e.state === ES.IDLE) {
      this._queue(['overhead'], CONFIG.tutorial.openHoldMs);
      this._go('dodge', 'Here it comes…', 0);
    }

    const rem = e.telegraphRemaining();
    if (!this.froze && e.state === ES.TELEGRAPH) {
      const tc = CONFIG.tutorial;
      if (this.step === 'dodge' && rem <= tc.dodgeFreezeAt) {
        this.froze = true;
        this.frozen = 'dodge';
        this.hud.pulse(['dodgeL', 'dodgeR'], true);
        this.hud.banner(say('TAP A DODGE BUTTON to step aside!', 'Press A or D to step aside!'), 0);
      } else if (this.step === 'block' && rem <= tc.blockFreezeAt) {
        this.froze = true;
        this.frozen = 'block';
        this.hud.pulse(['block'], true);
        this.hud.banner(say('HOLD the shield button to block!', 'HOLD S (or Space) to block!'), 0);
      } else if (this.step === 'parry' && rem <= tc.parryFreezeAt) {
        this.froze = true;
        this.frozen = 'parry';
        this.hud.banner(say('SWIPE UP, against his falling blow!', 'Press ↑, against his falling blow!'), 0, '↑');
      }
    }

    // Advance once the enemy has finished his open window.
    if (e.state === ES.IDLE && e.script.length === 0) {
      if (this.step === 'strike') {
        this._queue(['slashE']);
        this._go('block', 'Now a sideways slash. Get ready to BLOCK with your shield.', 0);
      } else if (this.step === 'strike2') {
        this._queue(['overhead'], CONFIG.tutorial.openHoldMs);
        this._go('parry', say('Best of all is the PARRY: as the glint FLARES, swipe AGAINST his blow.', 'Best of all is the PARRY: as the glint FLARES, press the arrow AGAINST his blow.'), 0);
      } else if (this.step === 'strike3') {
        this._go('free', 'Now fight! Parry and perfect dodges fill his stagger meter (the gold bar). Strike when he is open.', 4200);
        e.hold = false;
      }
    }
  }

  onDodge() {
    if (this.frozen === 'dodge' || this.frozen === 'parry') this._unfreeze();
  }

  onBlock(held) {
    if (held && (this.frozen === 'block' || this.frozen === 'parry')) this._unfreeze();
  }

  onClang() {
    if (this.frozen === 'parry') this.hud.banner(say('Swipe UP: straight against the falling axe!', 'Press ↑: straight against the falling axe!'), 0, '↑');
  }

  onParry() {
    if (this.step !== 'parry') return;
    this._unfreeze();
    this._go('strike3', 'Parried! His guard is broken. STRIKE him now!', 0);
  }

  onHit() {
    if (this.step.startsWith('strike')) {
      this.hits += 1;
      if (this.hits === 3) this.hud.banner('Good! Keep striking until he recovers.', 1600);
    }
  }

  onImpact(outcome) {
    if (this.step === 'dodge') {
      if (outcome === 'dodged' || outcome === 'perfect') {
        this.hits = 0;
        this._go('strike', say('He is OPEN! SWIPE across him to strike!', 'He is OPEN! Press arrow keys to strike!'), 0);
      } else {
        this._unfreeze();
        this._queue(['overhead'], CONFIG.tutorial.openHoldMs);
        this.hud.banner(say('Not quite. Tap a dodge button as the blow falls.', 'Not quite. Press A or D as the blow falls.'), 0);
      }
    } else if (this.step === 'block') {
      if (outcome === 'blocked' || outcome === 'perfectBlock') {
        this.hits = 0;
        this._go('strike2', 'Blocked! Each block costs a shield pip. Now strike back!', 0);
      } else {
        this._unfreeze();
        this._queue(['slashE']);
        this.hud.banner(say('Hold the shield button down until the blow lands.', 'Hold S down until the blow lands.'), 0);
      }
    } else if (this.step === 'parry') {
      // An impact means the parry was missed.
      this._unfreeze();
      this.parryTries += 1;
      if (this.parryTries >= 2) {
        this._go('free', 'Parrying takes practice. Now fight! Strike whenever he is open.', 4000);
        this.e.hold = false;
      } else {
        this._queue(['overhead'], CONFIG.tutorial.openHoldMs);
        this.hud.banner(say('Once more: as the glint flares, swipe UP against the blow.', 'Once more: as the glint flares, press ↑ against the blow.'), 0);
      }
    }
  }
}
