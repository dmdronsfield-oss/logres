import { CONFIG, PALETTE, VIEW } from '../config.js';

export const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

export const DIR_VEC = {
  E: [1, 0], SE: [0.7071, 0.7071], S: [0, 1], SW: [-0.7071, 0.7071],
  W: [-1, 0], NW: [-0.7071, -0.7071], N: [0, -1], NE: [0.7071, -0.7071],
};

export const DIR_ARROW = { E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖', N: '↑', NE: '↗' };

export function opposite(dir) {
  return DIRS[(DIRS.indexOf(dir) + 4) % 8];
}

// Number of 45° steps between two directions (0-4).
export function dirDistance(a, b) {
  const d = Math.abs(DIRS.indexOf(a) - DIRS.indexOf(b)) % 8;
  return Math.min(d, 8 - d);
}

// Turns raw pointers into swipes and button presses. Supports multi-touch:
// one thumb can hold block while the other swipes (the swipe is then ignored).
export class SwipeInput {
  constructor(scene, handlers) {
    this.scene = scene;
    this.h = handlers; // { onSwipe(dir, info), onButtonDown(id), onButtonUp(id), swipesBlocked(), tolerance() }
    this.buttons = [];
    this.active = new Map();
    this.trails = [];
    this.enabled = true;
    this.lastDir = '-';

    this.gfx = scene.add.graphics().setDepth(36);

    scene.input.addPointer(2);
    scene.input.on('pointerdown', this._down, this);
    scene.input.on('pointermove', this._move, this);
    scene.input.on('pointerup', this._up, this);
    scene.input.on('pointerupoutside', this._up, this);
    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', this._down, this);
      scene.input.off('pointermove', this._move, this);
      scene.input.off('pointerup', this._up, this);
      scene.input.off('pointerupoutside', this._up, this);
    });
  }

  // Circle (r) or rect (w, h) hit zone. Buttons are hit-tested before swipes.
  addButton(id, x, y, { r = 0, w = 0, h = 0, pad = 10 } = {}) {
    const b = { id, x, y, r, w, h, pad, enabled: true };
    this.buttons.push(b);
    return b;
  }

  _hit(x, y) {
    for (const b of this.buttons) {
      if (!b.enabled) continue;
      if (b.r) {
        if (Phaser.Math.Distance.Between(x, y, b.x, b.y) <= b.r + b.pad) return b;
      } else if (Math.abs(x - b.x) <= b.w / 2 + b.pad && Math.abs(y - b.y) <= b.h / 2 + b.pad) {
        return b;
      }
    }
    return null;
  }

  _down(p) {
    if (!this.enabled) return;
    const b = this._hit(p.worldX, p.worldY);
    if (b) {
      this.active.set(p.id, { type: 'button', id: b.id });
      this.h.onButtonDown?.(b.id);
      return;
    }
    // A tap can be claimed outright (the blade lock: every touch pushes).
    if (this.h.onTap?.()) return;
    const now = performance.now();
    this.active.set(p.id, { type: 'swipe', pts: [{ x: p.worldX, y: p.worldY, t: now }], fired: false });
  }

  _move(p) {
    const a = this.active.get(p.id);
    if (!a || a.type !== 'swipe' || !p.isDown) return;
    const now = performance.now();
    a.pts.push({ x: p.worldX, y: p.worldY, t: now });
    if (a.pts.length > 60) a.pts.shift();
    if (!a.fired) {
      const res = this._evaluate(a.pts, now, CONFIG.swipe.earlyTriggerMult);
      if (res) {
        a.fired = true;
        this._fire(res, a.pts);
      }
    }
  }

  _up(p) {
    const a = this.active.get(p.id);
    if (!a) return;
    this.active.delete(p.id);
    if (a.type === 'button') {
      this.h.onButtonUp?.(a.id);
      return;
    }
    if (a.fired) return;
    const now = performance.now();
    a.pts.push({ x: p.worldX, y: p.worldY, t: now });
    const res = this._evaluate(a.pts, now, 1);
    if (res) this._fire(res, a.pts);
  }

  // CSS pixels per logical unit, so thresholds feel the same on every phone.
  _cssPerUnit() {
    const ds = this.scene.scale.displayScale; // game pixels per CSS pixel
    return VIEW.RES / (ds.x || 1);
  }

  _evaluate(pts, now, distMult) {
    const maxDur = CONFIG.swipe.maxDurationMs * (this.h.tolerance?.() ?? 1);
    // Only the travelling part counts: the points within the last maxDur ms.
    let start = pts[0];
    for (const pt of pts) {
      if (now - pt.t <= maxDur) { start = pt; break; }
    }
    const end = pts[pts.length - 1];
    if (now - start.t > maxDur) return null;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distCss = Math.hypot(dx, dy) * this._cssPerUnit();
    if (distCss < CONFIG.swipe.minDistPx * distMult) return null;
    const ang = Math.atan2(dy, dx);
    const idx = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
    return { dir: DIRS[idx], dx, dy, x: end.x, y: end.y, sx: start.x, sy: start.y };
  }

  _fire(res, pts) {
    if (this.h.swipesBlocked?.()) return;
    this.lastDir = res.dir;
    this.trails.push({ pts: pts.map((q) => ({ x: q.x, y: q.y })), born: performance.now() });
    this.h.onSwipe?.(res.dir, res);
  }

  update() {
    const now = performance.now();
    const g = this.gfx;
    g.clear();
    // Live trails for fingers still down.
    for (const a of this.active.values()) {
      if (a.type === 'swipe' && !a.fired && a.pts.length > 1 && !this.h.swipesBlocked?.()) {
        const recent = a.pts.filter((q) => now - q.t < 160);
        this._drawTrail(g, recent, 0.55);
      }
    }
    this.trails = this.trails.filter((t) => now - t.born < CONFIG.swipe.trailFadeMs);
    for (const t of this.trails) {
      const k = 1 - (now - t.born) / CONFIG.swipe.trailFadeMs;
      this._drawTrail(g, t.pts, k);
    }
  }

  _drawTrail(g, pts, alpha) {
    if (pts.length < 2) return;
    const n = pts.length;
    for (let i = 1; i < n; i++) {
      const w = CONFIG.swipe.trailWidth * (0.25 + 0.75 * (i / n));
      g.lineStyle(w + 5, PALETTE.ink, alpha * 0.25);
      g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      g.lineStyle(w, 0xf6d061, alpha);
      g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    }
    const last = pts[n - 1];
    g.fillStyle(0xfff6cf, alpha);
    g.fillCircle(last.x, last.y, CONFIG.swipe.trailWidth * 0.7);
  }

  // A swipe from the keyboard: draw its stroke across the middle of the screen.
  keySwipe(dir) {
    if (!this.enabled) return;
    const [dx, dy] = DIR_VEC[dir];
    const cx = VIEW.W / 2;
    const cy = VIEW.H * 0.42;
    const L = Math.min(VIEW.W, VIEW.H) * 0.22;
    const now = performance.now();
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8 - 0.5;
      pts.push({ x: cx + dx * L * 2 * t, y: cy + dy * L * 2 * t, t: now });
    }
    this._fire({ dir, dx, dy }, pts);
  }

  // Release everything (e.g. when pausing) so held buttons don't stick.
  releaseAll() {
    for (const a of this.active.values()) {
      if (a.type === 'button') this.h.onButtonUp?.(a.id);
    }
    this.active.clear();
  }
}
