// Development test harness (not shipped to players; not in the service worker).
// In the browser console on /side/:  const h = await import('/tools/harness.js');
// Drives the game frame by frame so tests don't depend on the tab being visible.

const OPP = { E: 'W', W: 'E', S: 'N', N: 'S', SE: 'NW', SW: 'NE', NE: 'SW', NW: 'SE' };
const DIRS = ['E', 'W', 'S', 'N', 'SE', 'SW', 'NE', 'NW'];
let T = performance.now();

export const game = () => window.__logres;
export const duel = () => game().scene.getScene('Duel');

// Take over the clock: Phaser and tweens advance only when step() is called.
export function manual() {
  game().loop.sleep();
  Phaser.Tweens.TweenManager.prototype.getDelta = () => 16.67;
}

export function live() {
  game().loop.wake();
}

export function step(n = 1, each = null) {
  for (let i = 0; i < n; i++) {
    T += 16.67;
    game().step(T, 16.67);
    if (each && each(i) === false) return i;
  }
  return n;
}

// Step until cond() is true (or n frames pass). Returns frames taken, or -1.
export function until(cond, n = 3000) {
  for (let i = 0; i < n; i++) {
    if (cond()) return i;
    step(1);
  }
  return -1;
}

export async function save(patch) {
  const { Save } = await import('/src/save/Save.js');
  Save.set(patch);
}

// Start a duel from the title (or restart from Victory/Death) and wait for the foe.
export function startDuel() {
  const g = game();
  for (const k of ['Title', 'Victory', 'Death']) {
    const sc = g.scene.getScene(k);
    if (sc && sc.sys.isActive()) sc.scene.start('Duel');
  }
  return until(() => { const d = duel(); return d && d.sys.isActive() && d.enemy && d.enemy.state === 'Idle'; }, 600);
}

// A bot: perfect-ish defence and opportunistic attacks. skill 0..1.
export function bot(frames, skill = 1) {
  let acted = null;
  let blockOff = 0;
  let at = null;
  const errors = [];
  step(frames, () => {
    const d = duel();
    if (!d.sys.isActive() || !d.enemy || d.director.over) return true;
    if (d.paused) d.resume();   // a hidden test tab counts as the app going to the background
    if (d.director.lock) {
      if (Math.random() < 0.13 * skill) d.director.lockTap();
      return true;
    }
    const e = d.enemy;
    const tut = d.tutorial;
    if (blockOff && T > blockOff) { d.director.onBlock(false); blockOff = 0; }
    if (tut && tut.frozen) {
      if (tut.frozen === 'dodge') d.director.onDodge(e.attack.dodge[0] || 'left');
      else if (tut.frozen === 'block') { d.director.onBlock(true); blockOff = T + 400; }
      else if (tut.frozen === 'parry') d.swipe.keySwipe(OPP[e.attack.direction] || 'N');
      return true;
    }
    if (e.state === 'Telegraph') {
      if (acted !== e.attack) { acted = e.attack; at = skill >= 1 ? 110 : 40 + Math.random() * 300; }
      const rem = e.telegraphTotal - e.t;
      if (at !== null && rem < at) {
        at = null;
        const r = Math.random();
        const ok = Math.random() < skill;
        if (e.attack.parryable && r < 0.45) d.swipe.keySwipe(ok ? (e.attack.direction === 'T' ? 'E' : OPP[e.attack.direction]) : DIRS[(Math.random() * 8) | 0]);
        else if (e.attack.dodge.length && (r < 0.8 || e.attack.unblockable)) d.director.onDodge(ok ? e.attack.dodge[0] : (Math.random() < 0.5 ? 'left' : 'right'));
        else { d.director.onBlock(true); blockOff = T + 300; }
      }
    } else if (e.state === 'Idle' && e.gapDirs && e.gapDirs().length && Math.random() < 0.02 * skill) {
      d.swipe.keySwipe(Math.random() < skill ? e.gapDirs()[0] : DIRS[(Math.random() * 8) | 0]);
    } else if (e.isOpen() && Math.random() < 0.06) {   // ~3.5 swipes a second, about human
      const h = d.director.riposte ? d.director.riposte.dir
        : d.director.comboHint ? d.director.comboHint.combo.seq[d.director.comboHint.step] : DIRS[(Math.random() * 8) | 0];
      d.swipe.keySwipe(h);
    }
    return true;
  });
  const d = duel();
  return {
    scene: game().scene.getScenes(true).map((s) => s.scene.key)[0], foe: d.def && d.def.id, over: d.director && d.director.over,
    foeHP: d.enemy && d.enemy.health, youHP: d.player && d.player.health, stats: d.director && d.director.stats, errors,
  };
}

// Render one real frame so a screenshot shows the current state.
export async function show() {
  live();
  await new Promise((r) => setTimeout(r, 120));
  game().loop.sleep();
}
