import { CONFIG, VIEW } from '../config.js';
import { Fighter } from './Fighter.js';
import { buildPlayerRig } from '../art/Rig.js';
import { DIR_VEC } from '../input/SwipeInput.js';

export const PS = {
  READY: 'Ready',
  ATTACKING: 'Attacking',
  DODGING: 'Dodging',
  BLOCKING: 'Blocking',
  STUNNED: 'Stunned',
  DEAD: 'Dead',
};

export class Player extends Fighter {
  constructor(scene, { level, sword, shield, leftHanded }) {
    const p = CONFIG.progression;
    super(scene, Math.round(CONFIG.player.baseHealth * (1 + p.healthPerLevel * (level - 1))));
    this.sword = sword;
    this.shieldDef = shield;
    this.damage = CONFIG.player.baseDamage * sword.damage * (1 + p.damagePerLevel * (level - 1));
    this.damageMult = sword.damage * (1 + p.damagePerLevel * (level - 1));

    this.state = PS.READY;
    this.stateT = 0;
    this.blockHeld = false;
    this.maxPips = shield.pips;
    this.pips = shield.pips;
    this.regenT = 0;
    this.dodgeSide = null;

    this.rig = (scene.rigFactory?.player || buildPlayerRig)(scene, sword, shield, leftHanded);
    this.rig.swordArm.setDepth(30);
    this.rig.shield.setDepth(31);
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  // State to return to once a timed action ends.
  _rest() {
    this.setState(this.blockHeld ? PS.BLOCKING : PS.READY);
    if (this.state === PS.BLOCKING) this._raiseShield();
  }

  update(dt) {
    this.stateT += dt;
    switch (this.state) {
      case PS.ATTACKING:
        if (this.stateT >= CONFIG.player.attackMs) this._rest();
        break;
      case PS.DODGING:
        if (this.stateT >= CONFIG.dodge.durationMs) this._rest();
        break;
      case PS.STUNNED:
        if (this.stateT >= CONFIG.player.stunMs) {
          this._rest();
          this._home(120);
        }
        break;
      default:
        break;
    }
    if (this.state !== PS.BLOCKING && this.pips < this.maxPips) {
      this.regenT += dt;
      if (this.regenT >= this.shieldDef.regenMs) {
        this.regenT = 0;
        this.pips += 1;
      }
    } else if (this.state === PS.BLOCKING) {
      this.regenT = 0;
    }
  }

  canSwing() {
    return this.state === PS.READY || (this.state === PS.ATTACKING && this.stateT >= CONFIG.player.attackMs * 0.75);
  }

  get dodgeElapsed() {
    return this.state === PS.DODGING ? this.stateT : Infinity;
  }

  swing(dir) {
    this.setState(PS.ATTACKING);
    const [dx, dy] = DIR_VEC[dir];
    const arm = this.rig.swordArm;
    const home = this.rig.swordHome;
    const cx = Phaser.Math.Linear(home.x, VIEW.W / 2, 0.5);
    const cy = home.y - 40;
    const reach = 120;
    this.scene.tweens.killTweensOf(arm);
    arm.setPosition(cx - dx * reach, cy - dy * reach * 0.8);
    arm.setAngle(home.angle * 0.3 - dx * 55);
    arm.setScale(1, 1);
    this.scene.tweens.add({
      targets: arm,
      x: cx + dx * reach,
      y: cy + dy * reach * 0.8,
      angle: home.angle * 0.3 + dx * 55,
      scaleY: dy > 0.5 ? 0.88 : 1,
      duration: 85,
      ease: 'Quad.easeOut',
      onComplete: () => this._home(170),
    });
  }

  _home(ms) {
    const arm = this.rig.swordArm;
    const home = this.rig.swordHome;
    this.scene.tweens.add({
      targets: arm, x: home.x, y: home.y, angle: home.angle, scaleY: 1, duration: ms, ease: 'Sine.easeOut',
    });
  }

  startDodge(side) {
    if (this.state === PS.DODGING || this.state === PS.STUNNED || this.state === PS.DEAD) return false;
    if (this.state === PS.BLOCKING) this._lowerShield();
    this.setState(PS.DODGING);
    this.dodgeSide = side;
    return true;
  }

  setBlock(held) {
    this.blockHeld = held;
    if (held && (this.state === PS.READY || this.state === PS.ATTACKING)) {
      this.setState(PS.BLOCKING);
      this._raiseShield();
    } else if (!held && this.state === PS.BLOCKING) {
      this.setState(PS.READY);
      this._lowerShield();
    }
  }

  isBlocking() {
    return this.state === PS.BLOCKING;
  }

  _raiseShield() {
    const s = this.rig.shield;
    this.scene.tweens.killTweensOf(s);
    this.scene.tweens.add({
      targets: s,
      x: VIEW.W / 2 - this.rig.side * 30,
      y: VIEW.H - 10,
      angle: 0,
      scale: 1.12,
      duration: CONFIG.block.raiseMs,
      ease: 'Quad.easeOut',
    });
  }

  _lowerShield() {
    const s = this.rig.shield;
    const h = this.rig.shieldHome;
    this.scene.tweens.killTweensOf(s);
    this.scene.tweens.add({ targets: s, x: h.x, y: h.y, angle: h.angle, scale: 1, duration: 120, ease: 'Sine.easeOut' });
  }

  blockImpact() {
    this.pips = Math.max(0, this.pips - 1);
    this.regenT = 0;
    const s = this.rig.shield;
    this.scene.tweens.add({ targets: s, y: s.y + 26, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
  }

  takeHit(amount) {
    const dead = this.applyDamage(amount);
    if (this.state === PS.BLOCKING) this._lowerShield();
    if (dead) {
      this.setState(PS.DEAD);
      this.die();
      return true;
    }
    this.setState(PS.STUNNED);
    const arm = this.rig.swordArm;
    this.scene.tweens.killTweensOf(arm);
    this.scene.tweens.add({
      targets: arm,
      angle: this.rig.swordHome.angle + this.rig.side * 22,
      y: this.rig.swordHome.y + 60,
      duration: 90,
      ease: 'Quad.easeOut',
    });
    return false;
  }

  die() {
    const { swordArm, shield } = this.rig;
    this.scene.tweens.killTweensOf([swordArm, shield]);
    this.scene.tweens.add({ targets: swordArm, y: VIEW.H + 340, angle: swordArm.angle + 40 * this.rig.side, duration: 900, ease: 'Quad.easeIn' });
    this.scene.tweens.add({ targets: shield, y: VIEW.H + 340, angle: -30 * this.rig.side, duration: 1000, ease: 'Quad.easeIn' });
  }
}
