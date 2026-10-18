# Logres

A 2D swipe-duel sword-fighting game set in Arthurian Britain. It plays in a phone browser with nothing to install.

**Play:** https://dmdronsfield-oss.github.io/logres/

**3D test:** https://dmdronsfield-oss.github.io/logres/3d/ (same game rendered in 3D with Three.js; keeps its own save so it doesn't touch your 2D progress)

**3D third-person (main direction):** https://dmdronsfield-oss.github.io/logres/side/ (a voxel-style tourney in Camelot's great hall, seen over Sir Gawain's shoulder; five rounds, one challenger each; `?angle=NN` tries other camera angles)

Open it on your phone and turn the phone sideways. To play it like an app, choose **Add to Home Screen** (Safari: the Share button; Chrome: the ⋮ menu). It then opens full-screen and works offline.

## How to play

You face one enemy at a time. Watch his weapon: a **gold glint** marks where a blow begins. When the glint **flares**, the blow is about to land.

| Action | How | Notes |
|---|---|---|
| Strike | Swipe anywhere | Only lands while he is **open**: recovering after an attack, parried, or staggered. Otherwise he turns it aside. |
| Dodge | Left / right roundels | Sideways slashes must be dodged *against* the blade's travel. Overhead blows can be dodged either way. Thrusts can't be dodged. |
| Block | Hold the shield roundel | Stops anything, but each block costs a shield pip. Pips come back over time. You can't swipe while blocking. |
| Parry | Swipe *against* the blow as the glint flares | Breaks his guard and fills his stagger meter. Swipe up against an overhead, left against a left-to-right slash, and sideways against a thrust. A **red glint** can't be parried. |
| Super | Tap the star (top-left) when its ring is full | Stuns him and doubles your damage for a moment. |

- Parries, perfect dodges and blocks fill his **stagger meter** (the gold bar under his health). When it fills, he's open for two seconds and takes extra damage.
- **Known strikes:** swipe a sequence during one opening for a bonus blow. The combos are listed on the title screen.
- **Bloodline:** when you fall, your son takes up the oath with your gear and experience, and the run starts over. Beating the Green Knight starts a harder cycle.
- New swords and shields unlock at generation milestones. Choose your gear in camp (the title screen).

The first duel is a guided tutorial.

**Desktop testing:** drag with the mouse to swipe, ← → to dodge, hold Space to block, S for super, Esc to pause.

**Debug overlay:** tap the top-right corner five times during a duel to see FPS, enemy state and timing windows.

## Run locally

From the repo folder, run either of:

```bash
python3 -m http.server 8000
```

```bash
npx serve .
```

Then open http://localhost:8000 (or the port `serve` prints). The service worker is off on localhost so you always get fresh files; add `?sw=1` to test offline mode.

## Project layout

- `src/config.js`: every tunable number (timings, damage, meters, juice, gear).
- `src/combat/enemies.js`: enemies as data. Add an object to `ENEMIES` to add a duel; no code changes needed.
- `src/combat/`: the player, the enemy state machine, `CombatDirector` (the combat rules) and the tutorial.
- `src/art/`: all graphics, drawn in code with Canvas 2D (rigs, backgrounds, border).
- `src/audio/Sfx.js`: every sound, generated with the Web Audio API.
- `src/scenes/`: Boot, Title, Duel, Victory and Death (bloodline succession).

There's no build step: it's plain ES modules plus Phaser 3.80.1 from cdnjs. The `/3d/` page also loads Three.js 0.160.0 from jsDelivr (only on that page); `src/render3d/View3D.js` maps the same pose data onto toon-shaded 3D figures. All art and sound are generated in code; the only external asset is the Cinzel font from Google Fonts.

## Releasing

Bump `VERSION` in `service-worker.js` and push to `main`. GitHub Pages redeploys automatically, and installed copies pick up the new version on their next launch.
