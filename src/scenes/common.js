import { VIEW } from '../config.js';

// Logical 540-high coordinate space rendered at VIEW.RES via camera zoom.
export function setupCamera(scene) {
  const cam = scene.cameras.main;
  cam.setZoom(VIEW.RES);
  cam.centerOn(VIEW.W / 2, VIEW.H / 2);
  cam.setBackgroundColor('#1a1410');
  refreshSafeArea(scene);
}

// Read the notch/home-bar insets (CSS px) and convert to logical units.
export function refreshSafeArea(scene) {
  const probe = document.getElementById('safe-probe');
  const canvas = scene.game.canvas;
  if (!probe || !canvas) return;
  const cs = getComputedStyle(probe);
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const k = VIEW.W / rect.width;
  // Only the part of the inset that actually overlaps the canvas matters.
  const overL = Math.max(0, parseFloat(cs.paddingLeft) - rect.left);
  const overR = Math.max(0, parseFloat(cs.paddingRight) - (window.innerWidth - rect.right));
  const overB = Math.max(0, parseFloat(cs.paddingBottom) - (window.innerHeight - rect.bottom));
  VIEW.safeL = overL * k;
  VIEW.safeR = overR * k;
  VIEW.safeB = Math.min(20, overB * k);
}

// white: fade out to white (a won duel going to Victory, which fades in from white).
export function fadeTo(scene, key, data, white = false) {
  if (scene._leaving) return;
  scene._leaving = true;
  if (white) scene.cameras.main.fadeOut(480, 255, 255, 255);
  else scene.cameras.main.fadeOut(260, 26, 20, 16);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

// True when the screen needs turning: pages without a portrait layout held upright.
export function isPortrait() {
  if (window.LOGRES_CAM === 'side') return false;
  return window.innerHeight > window.innerWidth;
}

// Portrait layouts: map a y authored for the 540-high landscape screen onto the
// tall screen, centred on `anchor` (a fraction of the height).
export function py(y, anchor = 0.5) {
  if (!VIEW.portrait) return y;
  return Math.round(VIEW.H * anchor + (y - 270));
}

// The menus' backdrop: the Sacra di San Michele above the clouds. Landscape: the photograph
// covers the screen with the abbey centred. Upright: the whole abbey near the top, fading
// into fog (the photograph's own colour) top and bottom.
const FOG = 0xd8d6d2;
export function abbeyBackdrop(scene) {
  const W = VIEW.W;
  const H = VIEW.H;
  if (!scene.textures.exists('abbey')) return null;
  const im = scene.add.image(W / 2, 0, 'abbey');
  const tw = im.width;
  const th = im.height;
  // The abbey's middle sits about a third of the way across and 42% down the photograph.
  const fx = 0.36;
  const fy = 0.42;
  im.setOrigin(fx, fy);
  if (!VIEW.portrait) {
    const cy = H * 0.46;
    const s = Math.max((W / 2) / (fx * tw), (W / 2) / ((1 - fx) * tw), cy / (fy * th), (H - cy) / ((1 - fy) * th));
    im.setScale(s).setPosition(W / 2, cy);
    return im;
  }
  scene.add.rectangle(W / 2, H / 2, W + 40, H + 40, FOG).setDepth(-2);
  im.setDepth(-1);
  const s = (W * 1.02) / (0.62 * tw);   // the abbey, about 62% of the photograph's width, fills the screen's
  const cy = H * 0.31;
  im.setScale(s).setPosition(W / 2, cy);
  const top = cy - fy * th * s;
  const bottom = cy + (1 - fy) * th * s;
  const key = `fogfade_${W}`;
  if (!scene.textures.exists(key)) {
    const t = scene.textures.createCanvas(key, 4, 256);
    const ctx = t.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(216,214,210,0)');
    g.addColorStop(1, 'rgba(216,214,210,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    t.refresh();
  }
  const fade = Math.round(th * s * 0.18);
  scene.add.image(W / 2, bottom - fade / 2, key).setDisplaySize(W + 40, fade).setDepth(-1);
  if (top > 0) scene.add.image(W / 2, top + fade / 2, key).setDisplaySize(W + 40, fade).setFlipY(true).setDepth(-1);
  return im;
}
