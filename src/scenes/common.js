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

export function fadeTo(scene, key, data) {
  if (scene._leaving) return;
  scene._leaving = true;
  scene.cameras.main.fadeOut(260, 26, 20, 16);
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
