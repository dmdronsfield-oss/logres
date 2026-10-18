import { VIEW, MODE } from './config.js';
import { Sfx } from './audio/Sfx.js';
import { Boot } from './scenes/Boot.js';
import { Title } from './scenes/Title.js';
import { Duel } from './scenes/Duel.js';
import { Victory } from './scenes/Victory.js';
import { Death } from './scenes/Death.js';

// Choose a logical width that matches the phone's landscape aspect, and a
// render resolution so art stays sharp on high-DPI screens.
const long = Math.max(window.innerWidth, window.innerHeight);
const short = Math.min(window.innerWidth, window.innerHeight) || 1;
const aspect = Math.min(VIEW.maxAspect, Math.max(VIEW.minAspect, long / short));
VIEW.W = Math.round(VIEW.H * aspect);
const dpr = window.devicePixelRatio || 1;
VIEW.RES = Math.min(VIEW.maxRes, Math.max(1, Math.round(((short * dpr) / VIEW.H) * 4) / 4));

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
