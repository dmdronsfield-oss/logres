import { CONFIG, VIEW, PALETTE, MODE } from '../config.js';
import { Save } from '../save/Save.js';
import { Sfx } from '../audio/Sfx.js';
import { Music } from '../audio/Music.js';
import { comfort } from '../ui/Comfort.js';
import { ENEMIES } from '../combat/enemies.js';
import { Player } from '../combat/Player.js';
import { Enemy } from '../combat/Enemy.js';
import { CombatDirector } from '../combat/CombatDirector.js';
import { Tutorial } from '../combat/Tutorial.js';
import { Juice } from '../fx/Juice.js';
import { SwipeInput } from '../input/SwipeInput.js';
import { bindDuelKeys, desktopLikely } from '../input/Keys.js';
import { Hud } from '../ui/Hud.js';
import { menuButton } from '../ui/Button.js';
import { img, text, canvasTex } from '../art/Tex.js';
import { PLAYER_CREST, playerName } from '../art/Heraldry.js';
import { backgroundKey } from '../art/Backgrounds.js';
import { setupCamera, fadeTo, isPortrait, py } from './common.js';

export class Duel extends Phaser.Scene {
  constructor() {
    super('Duel');
  }

  create() {
    this._leaving = false;
    this._ended = false;
    this.paused = false;
    setupCamera(this);
    this.tweens.timeScale = 1;
    const W = VIEW.W;
    const H = VIEW.H;
    const s = Save.data;
    const def = ENEMIES[s.runStage] || ENEMIES[0];
    this.def = def;

    // World layer slides on dodges (in 3D the camera follows it instead).
    this.world = this.add.container(0, 0).setDepth(10);
    this.w3 = MODE === '3d' ? VIEW.world3d : null;
    if (this.w3) {
      this.w3.clear();
      this.w3.buildEnv(def.scene);
      this.rigFactory = {
        enemy: (scene, d) => this.w3.buildEnemy(d),
        player: (scene, sword, shield, leftHanded) => this.w3.buildPlayer(sword, shield, leftHanded),
      };
      this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
      this.w3.show(true);
    } else {
      this.rigFactory = null;
      this.bgKey = backgroundKey(this, def.scene);
      this.world.add(img(this, W / 2, H / 2, this.bgKey));
    }

    this.juice = new Juice(this);
    this.player = new Player(this, {
      level: s.level, sword: Save.sword(), shield: Save.shield(), leftHanded: s.leftHanded,
    });
    // In the side view the fighters fill the upper screen, so prompts go lower.
    const bannerY = VIEW.portrait ? Math.round(H * 0.6) : this.w3 && this.w3.cam === 'side' ? 372 : 236;
    const tourney = this.w3 && this.w3.tourney ? {
      playerName: playerName(s.generation),
      round: s.runStage + 1,
      rounds: ENEMIES.length,
      playerCrest: PLAYER_CREST,
      enemyCrest: def.crest || { field: def.palette.body, charge: null },
      enemyId: def.id,
    } : null;
    this.hud = new Hud(this, {
      enemyName: def.name, leftHanded: s.leftHanded, bannerY, style: tourney ? 'tourney' : 'classic', tourney,
    });
    if (tourney) {
      // Painterly vignette over the 3D hall, under the HUD.
      const vk = canvasTex(this, `vignette_${W}`, W, H, (ctx) => {
        const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.35, W / 2, H * 0.5, W * 0.62);
        g.addColorStop(0, 'rgba(10,8,14,0)');
        g.addColorStop(1, 'rgba(10,8,14,0.72)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      });
      img(this, W / 2, H / 2, vk).setDepth(6);
    }
    this.director = new CombatDirector(this, { player: this.player, juice: this.juice, hud: this.hud });
    this.enemy = new Enemy(this, def, { cycle: s.cycle, x: W / 2, y: 318, director: this.director });
    this.world.add(this.w3 ? [this.enemy.aura] : [this.enemy.aura, this.enemy.rig.root]);
    this.director.enemy = this.enemy;

    this.tutorial = !s.tutorialDone && s.runStage === 0 ? new Tutorial(this.director, this.hud) : null;
    if (!this.tutorial) this.hud.banner(`${def.name}, ${def.epithet}`, this.w3 ? 2800 : 1900);

    this._setupInput();

    this._onVis = () => { if (document.hidden) this.pause(); };
    document.addEventListener('visibilitychange', this._onVis);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', this._onVis);
      if (this.input.keyboard) this.input.keyboard.removeAllListeners();
      this.tweens.timeScale = 1;
      if (this.bgKey && this.textures.exists(this.bgKey)) this.textures.remove(this.bgKey);
      if (this.w3) {
        this.w3.show(false);
        this.w3.clear();
      }
    });

    Music.play(def.id === 'green' ? 'boss' : 'duel');
    // Steel drawn as the duel begins.
    this.time.delayedCall(700, () => Sfx.draw());
    Sfx.crowd(true);
    this.events.once('shutdown', () => Sfx.crowd(false));
    this.heartT = 0;
    this.cameras.main.fadeIn(300, 26, 20, 16);
  }

  _setupInput() {
    const hud = this.hud;
    const d = this.director;
    this.debugTaps = [];
    this.swipe = new SwipeInput(this, {
      onSwipe: (dir) => d.onSwipe(dir),
      onTap: () => {
        if (!d.lock) return false;
        d.lockTap();
        return true;
      },
      swipesBlocked: () => this.player.blockHeld || this.paused,
      tolerance: () => this.player.sword.tolerance,
      onButtonDown: (id) => {
        Sfx.unlock();
        hud.press(id, true);
        if (id === 'dodgeL') d.onDodge('left');
        else if (id === 'dodgeR') d.onDodge('right');
        else if (id === 'block') d.onBlock(true);
        else if (id === 'super') d.onSuper();
        else if (id === 'pause') this.pause();
        else if (id === 'debug') this._debugTap();
      },
      onButtonUp: (id) => {
        hud.press(id, false);
        if (id === 'block') d.onBlock(false);
      },
    });
    for (const id of ['dodgeL', 'dodgeR', 'block', 'super', 'pause']) {
      const p = hud.pos[id];
      this.swipe.addButton(id, p.x, p.y, { r: p.r, pad: id === 'pause' ? 8 : 14 });
    }
    const cs = CONFIG.debug.cornerSize;
    const debugX = Save.data.leftHanded ? cs / 2 : VIEW.W - cs / 2;
    this.swipe.addButton('debug', debugX, cs / 2, { w: cs, h: cs, pad: 0 });

    // Desktop: arrows (or numpad) strike, A/D dodge, S/Space block, W/Enter super,
    // Esc/P pause. Mouse drag still swipes.
    const flashBtn = (id) => { hud.press(id, true); this.time.delayedCall(120, () => hud.press(id, false)); };
    bindDuelKeys(this, {
      used: () => { Sfx.unlock(); hud.showKeyHints(); },
      swipe: (dir) => { if (!this.paused) this.swipe.keySwipe(dir); },
      dodge: (side) => {
        if (this.paused) return;
        flashBtn(side === 'left' ? 'dodgeL' : 'dodgeR');
        d.onDodge(side);
      },
      block: (held) => {
        if (this.paused && held) return;
        hud.press('block', held);
        d.onBlock(held);
      },
      superMove: () => { if (!this.paused) { flashBtn('super'); d.onSuper(); } },
      confirm: () => { if (this.paused) { this.resume(); return true; } return false; },
      pause: () => (this.paused ? this.resume() : this.pause()),
    });
    if (desktopLikely()) hud.showKeyHints();
  }

  _debugTap() {
    const now = performance.now();
    this.debugTaps = this.debugTaps.filter((t) => now - t < CONFIG.debug.tapWindowMs);
    this.debugTaps.push(now);
    if (this.debugTaps.length >= CONFIG.debug.tapsToToggle) {
      this.debugTaps = [];
      this.hud.toggleDebug();
    }
  }

  dodgeShift(side) {
    const dir = side === 'left' ? 1 : -1;
    const shift = CONFIG.dodge.shift * dir;
    const dur = CONFIG.dodge.durationMs;
    this.tweens.killTweensOf(this.world);
    this.tweens.add({
      targets: this.world,
      x: shift,
      angle: dir * -1.5,
      duration: dur * 0.4,
      ease: 'Quad.easeOut',
      yoyo: true,
      hold: dur * 0.2,
      onComplete: () => { this.world.x = 0; this.world.angle = 0; },
    });
  }

  _debugInfo() {
    const e = this.enemy;
    const p = this.player;
    const rem = e.telegraphRemaining();
    return [
      `FPS ${Math.round(this.game.loop.actualFps)}`,
      `Enemy ${e.state}  t=${Math.round(e.t)}`,
      `Attack ${e.attack ? `${e.attack.id} (${e.attack.direction})` : '-'}`,
      `Impact in ${Number.isFinite(rem) ? Math.round(rem) : '-'} ms`,
      `Parry window ${e.inParryWindow() ? 'OPEN' : 'closed'} (${CONFIG.parry.windowMs}ms)`,
      `Open ${Math.round(e.openFraction() * 100)}%  Stagger ${Math.round(e.stagger)}`,
      `Player ${p.state}  pips ${p.pips}/${p.maxPips}`,
      `Last swipe ${this.swipe.lastDir}`,
      `Time scale ${this.juice.scale().toFixed(2)}`,
    ].join('\n');
  }

  update(time, delta) {
    const dReal = Math.min(delta, 50);
    if (!this.paused && isPortrait()) this.pause();
    if (this.paused) {
      this.swipe.update();
      if (this.w3) this.w3.render(this, 0);
      return;
    }
    this.juice.update(dReal);
    const scale = this.juice.scale() * (this.tutorial ? this.tutorial.scale() : 1);
    this.tweens.timeScale = scale;
    const dt = dReal * scale;
    // Slow motion and tutorial freezes stop the world, not you: your own moves keep
    // real time (hit-stop still holds them), so a freeze can never trap you mid-dodge.
    this.player.update(dReal * (this.juice.stopLeft > 0 ? 0 : 1));
    this.enemy.update(dt);
    this.director.update(dReal);
    // Low on health: your heart in your ears.
    if (this.player.healthFrac < 0.3 && !this.director.over) {
      this.heartT -= dReal;
      if (this.heartT <= 0) { Sfx.heartbeat(); this.heartT = 600 + this.player.healthFrac * 1500; }
    }
    if (this.tutorial) this.tutorial.update(dReal);
    this.swipe.update();
    this.hud.update(dReal, () => this._debugInfo());
    if (this.w3) this.w3.render(this, dt);
  }

  // ---------- pause menu ----------

  pause() {
    if (this.paused || this.director.over) return;
    this.paused = true;
    this.swipe.releaseAll();
    this.swipe.enabled = false;
    this.player.setBlock(false);
    this.tweens.pauseAll();
    const W = VIEW.W;
    const H = VIEW.H;
    const c = this.add.container(0, 0).setDepth(70);
    c.add(this.add.rectangle(W / 2, H / 2, W + 400, H + 400, 0x120c08, 0.72).setInteractive());
    // Upright phones get finger-sized buttons, spread over the taller screen.
    const P = VIEW.portrait;
    const my = (y) => py(P ? 270 + (y - 270) * 1.45 : y);
    const bh = P ? 60 : 42;
    c.add(text(this, W / 2, my(64), 'Paused', {
      fontSize: '42px', fontStyle: '700', color: PALETTE.goldLight, stroke: PALETTE.inkCss, strokeThickness: 8,
    }));
    const toggle = (y, label, get, set) => {
      const b = menuButton(this, W / 2, my(y), P ? 380 : 320, bh, '', () => { set(!get()); b.setLabel(`${label}: ${get() ? 'on' : 'off'}`); }, { size: P ? 22 : 18 });
      b.setLabel(`${label}: ${get() ? 'on' : 'off'}`);
      c.add(b);
    };
    c.add(menuButton(this, W / 2, my(130), P ? 380 : 300, P ? 68 : 52, 'Resume', () => this.resume(), { size: P ? 28 : 25, fill: '#f6dc8a' }));
    toggle(190, 'Sound', () => !Save.data.muted, (v) => { Save.set({ muted: !v }); Sfx.setMuted(!v); });
    toggle(240, 'Music', () => Save.data.music !== false, (v) => { Save.set({ music: v }); Music.setEnabled(v); });
    toggle(290, 'Vibration', () => Save.data.vibration, (v) => Save.set({ vibration: v }));
    toggle(340, 'Left-handed', () => Save.data.leftHanded, (v) => Save.set({ leftHanded: v }));
    // Comfort mode: calmer camera, softer flashes (defaults to the device's reduce-motion setting).
    toggle(440, 'Comfort mode', () => comfort(), (v) => Save.set({ comfort: v }));
    if (this.w3 && this.w3.setQuality) {
      // Graphics: looks or battery life. Remembered; turns off the automatic step-down.
      const names = ['Low', 'Medium', 'High'];
      const gb = menuButton(this, W / 2, my(390), P ? 380 : 320, bh, '', () => {
        this.w3.setQuality((this.w3.quality + 2) % 3, true);
        gb.setLabel(`Graphics: ${names[this.w3.quality]}`);
      }, { size: P ? 22 : 18 });
      gb.setLabel(`Graphics: ${names[this.w3.quality]}`);
      c.add(gb);
    }
    c.add(menuButton(this, W / 2, my(498), P ? 380 : 300, P ? 60 : 46, 'Retreat to camp', () => {
      this.tweens.resumeAll();
      fadeTo(this, 'Title');
    }, { size: P ? 22 : 20 }));
    this.pauseMenu = c;
  }

  resume() {
    if (!this.paused) return;
    if (isPortrait()) return;
    this.paused = false;
    this.tweens.resumeAll();
    this.swipe.enabled = true;
    if (this.pauseMenu) this.pauseMenu.destroy();
    this.pauseMenu = null;
  }

  // ---------- end of duel ----------

  endDuel(won) {
    if (this._ended) return;
    this._ended = true;
    const s = Save.data;
    const def = this.def;
    const stats = this.director.stats;
    const tutorialPassed = !this.tutorial || this.tutorial.step === 'free' || won;
    if (won) {
      const xp = Math.round(def.xp * (1 + CONFIG.enemy.cycleMult * s.cycle));
      const levels = Save.addXp(xp);
      const currentRun = s.currentRun + 1;
      let runStage = s.runStage + 1;
      let { cycle, generation } = s;
      const final = runStage >= ENEMIES.length;
      if (final) {
        runStage = 0;
        cycle += 1;
        generation += 1;
      }
      const unlocks = final ? this._unlocksAt(generation) : [];
      Save.set({
        wins: s.wins + 1, currentRun, bestRun: Math.max(s.bestRun, currentRun), runStage, cycle, generation,
        tutorialDone: true,
      });
      fadeTo(this, 'Victory', { enemyId: def.id, xp, levels, final, unlocks, stats, fromWhite: true }, true);
    } else {
      const xp = Math.round(def.xp * CONFIG.progression.lossXpFraction);
      const levels = Save.addXp(xp);
      const generation = s.generation + 1;
      const unlocks = this._unlocksAt(generation);
      Save.set({
        deaths: s.deaths + 1, generation, runStage: 0, currentRun: 0, tutorialDone: s.tutorialDone || tutorialPassed,
      });
      fadeTo(this, 'Death', { enemyId: def.id, fallenGen: generation - 1, xp, levels, unlocks, shield: Save.shield().id });
    }
  }

  _unlocksAt(gen) {
    return [...CONFIG.swords, ...CONFIG.shields].filter((i) => i.unlockGen === gen).map((i) => i.name);
  }
}
