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
    } else if (e.isOpen() && (d.player.state !== 'Attacking' || d.player.stateT > 130) && Math.random() < 0.12) {   // measured: a swipe once the cut is nearly done
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

// Frame-by-frame contact sheet of your swing, from the game camera (the 3D canvas only).
// Each cell is the next distinct moment of the swing; hit-stop frames are skipped.
// Shows the sheet over the page (click it to dismiss). In a hidden pane, size the renderer
// first: sheetSetup(). Usage: sheetSetup(); swingSheet('E', 12, 4, { open: true })
export async function sheetSetup(w = 960, h = 540) {
  const { VIEW } = await import('/src/config.js');
  const w3 = VIEW.world3d;
  w3.renderer.setPixelRatio(1);
  w3.renderer.setSize(w, h, false);
  w3.composer.setPixelRatio(1);
  w3.composer.setSize(w, h);
  return w3;
}

export async function swingSheet(dir, cells = 12, cols = 4, opts = {}) {
  const { VIEW } = await import('/src/config.js');
  const w3 = VIEW.world3d;
  const d = duel();
  const e = d.enemy;
  const go = (n) => step(n, () => { if (d.paused) d.resume(); return true; });
  until(() => e.state === 'Idle', 3000);
  if (opts.open) { e.forceStagger(4000, false); go(12); }
  d.hud.hideBanner(true);
  const gl = w3.renderer.domElement;
  const sx = gl.width * 0.12, sy = gl.height * 0.02, sw = gl.width * 0.62, sh = gl.height * 0.96;
  const cw = 420;
  const ch = Math.round((cw * sh) / sw);
  const out = document.createElement('canvas');
  out.width = cw * cols;
  out.height = ch * Math.ceil(cells / cols);
  const ctx = out.getContext('2d');
  d.swipe.keySwipe(dir);
  let i = 0;
  let last = -1;
  for (let guard = 0; i < cells && guard < 200; guard++) {
    const st = Math.round(d.player.stateT);
    if (st !== last || d.player.state !== 'Attacking') {
      last = st;
      const x = (i % cols) * cw;
      const y = Math.floor(i / cols) * ch;
      ctx.drawImage(gl, sx, sy, sw, sh, x, y, cw, ch);
      ctx.fillStyle = '#000a';
      ctx.fillRect(x, y, 120, 22);
      ctx.fillStyle = '#ff0';
      ctx.font = '600 15px monospace';
      ctx.fillText(d.player.state === 'Attacking' ? `${st}ms` : 'guard', x + 4, y + 16);
      i++;
    }
    go(1);
  }
  let img = document.getElementById('sheetview');
  if (!img) {
    img = document.createElement('img');
    img.id = 'sheetview';
    img.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000;z-index:99999';
    img.onclick = () => img.remove();
    document.body.append(img);
  }
  img.src = out.toDataURL('image/jpeg', 0.9);
  return dir;
}
