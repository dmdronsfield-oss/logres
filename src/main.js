import { VIEW, MODE } from './config.js';
import { Sfx } from './audio/Sfx.js';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { Duel } from './scenes/Duel.js';
import { Victory } from './scenes/Victory.js';
import { Death } from './scenes/Death.js';

// Choose a logical size that matches the screen's aspect, and a render
// resolution so art stays sharp on high-DPI screens. The side view also plays
// upright: a 600-wide portrait layout; other pages ask you to turn the phone.
const long = Math.max(window.innerWidth, window.innerHeight);
const short = Math.min(window.innerWidth, window.innerHeight) || 1;
const aspect = Math.min(VIEW.maxAspect, Math.max(VIEW.minAspect, long / short));
const canPortrait = window.LOGRES_CAM === 'side';
VIEW.portrait = canPortrait && window.innerHeight > window.innerWidth;
const dpr = window.devicePixelRatio || 1;
if (VIEW.portrait) {
  VIEW.W = 600;
  VIEW.H = Math.round(600 * aspect);
  VIEW.RES = Math.min(VIEW.maxRes, Math.max(1, Math.round(((short * dpr) / VIEW.W) * 4) / 4));
} else {
  VIEW.W = Math.round(VIEW.H * aspect);
  VIEW.RES = Math.min(VIEW.maxRes, Math.max(1, Math.round(((short * dpr) / VIEW.H) * 4) / 4));
}
// Turning the device rebuilds the game in the other layout (progress is saved between duels).
if (canPortrait) {
  let t = null;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w > 200 && h > 200 && (h > w) !== VIEW.portrait && Math.abs(h - w) > 40) location.reload();
    }, 300);
  });
}

// Browsers only allow audio after a user gesture; unlock on the first touch.
const unlock = () => Sfx.unlock();
['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));

// Stop iOS pinch-zoom and double-tap zoom gestures.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || e.target.tagName === 'CANVAS') e.preventDefault(); }, { passive: false });

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a1410',
  transparent: MODE === '3d', // the 3D scene is drawn on a canvas underneath
  width: Math.round(VIEW.W * VIEW.RES),
  height: Math.round(VIEW.H * VIEW.RES),
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 3 },
  render: { antialias: true, powerPreference: 'high-performance' },
  disableContextMenu: true,
  scene: [Boot, Title, Duel, Victory, Death],
});

window.__logres = game;
