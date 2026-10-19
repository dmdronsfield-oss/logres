// Cache-first service worker. Bump VERSION on every release.
const VERSION = 'logres-v28';

const CORE = [
  './',
  './index.html',
  './3d/',
  './3d/index.html',
  './side/',
  './side/index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/main.js',
  './src/config.js',
  './src/input/SwipeInput.js',
  './src/input/Keys.js',
  './src/combat/Fighter.js',
  './src/combat/Player.js',
  './src/combat/Enemy.js',
  './src/combat/enemies.js',
  './src/combat/CombatDirector.js',
  './src/combat/Tutorial.js',
  './src/fx/Juice.js',
  './src/audio/Sfx.js',
  './src/audio/Music.js',
  './src/art/Tex.js',
  './src/art/Rig.js',
  './src/art/Backgrounds.js',
  './src/ui/Hud.js',
  './src/ui/Button.js',
  './src/scenes/common.js',
  './src/scenes/Boot.js',
  './src/scenes/Title.js',
  './src/scenes/Duel.js',
  './src/scenes/Victory.js',
  './src/scenes/Death.js',
  './src/save/Save.js',
  './src/render3d/View3D.js',
  './src/render3d/Hall3D.js',
  './src/render3d/Trail.js',
  './src/render3d/knight/Mat.js',
  './src/render3d/knight/Knight.js',
  './src/render3d/knight/Motion.js',
  './src/render3d/knight/Cloth.js',
  './src/render3d/knight/Looks.js',
  './src/render3d/knight/Skinned.js',
  './preview/',
  './preview/index.html',
  './lab/',
  './lab/index.html',
  './src/lab/Lab.js',
  './src/art/Heraldry.js',
  './assets/models/gawain/gawain.glb',
  './assets/models/inkxo-knight/inkxo-knight.glb',
  'https://cdnjs.cloudflare.com/ajax/libs/phaser/3.80.1/phaser.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // Cache fonts and anything else fetched at runtime for offline play.
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
    }),
  );
});
