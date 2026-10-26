# Logres

A 2D swipe-duel sword-fighting game set in Arthurian Britain. It plays in a phone browser with nothing to install.

**Play:** https://dmdronsfield-oss.github.io/logres/

**3D test:** https://dmdronsfield-oss.github.io/logres/3d/ (same game rendered in 3D with Three.js; keeps its own save so it doesn't touch your 2D progress)

**3D third-person (main direction):** https://dmdronsfield-oss.github.io/logres/side/ (a voxel-style tourney in Camelot's great hall, seen over Sir Gawain's shoulder; five rounds, one challenger each; `?angle=NN` tries other camera angles)

**Model preview:** https://dmdronsfield-oss.github.io/logres/preview/ (the same game with a rigged, skinned CC0 knight model by Quaternius standing in for the code-built knights, driven by our combat motion through a retargeting layer; files and licence in `assets/models/quaternius-knight/`)

**Sir Gawain model:** the player in `/side/` and `/preview/` is "Medieval Knight Armor (Low-poly / Rigged)" by INKXO (CC BY 4.0, https://sketchfab.com/3d-models/medieval-knight-armor-low-poly-rigged-428913948904425e8daec81eea9aa287), used whole with its own skeleton and driven by our combat motion (`assets/models/inkxo-knight/`). The sword and lion shield he holds, and the earlier pared-back Gawain, are in `assets/models/gawain/`.

**Animation lab:** https://dmdronsfield-oss.github.io/logres/lab/ (every move for every knight on a loop, at ¼ or ⅒ speed, with a scrubber and front, side, back and in-game views; tell me what to fix by move name and time)

Open it on your phone, held either way: the side view (`/side/`) has a portrait layout as well as landscape (the other pages are landscape only). To play it like an app, choose **Add to Home Screen** (Safari: the Share button; Chrome: the ⋮ menu). It then opens full-screen and works offline.

## How to play

You face one enemy at a time. Watch his weapon: his wind-up is the tell, and a **gold glint** at the blade **flares white** while the blow can be parried; a whoosh sounds as he releases it. Each foe shows less of his blow (brief 34): the Saxon also shows a **ring closing on the glint** (landing on it at the moment of impact) and an arrow for the blade's path; the Black Knight the glint and ring; the Brigand the glint alone; the Red and Green Knights only its flare. **Read his blade** (pause menu or camp) shows only the flare for every foe, as in Infinity Blade.

| Action | How | Notes |
|---|---|---|
| Strike | Swipe anywhere | Only lands while he is **open**: after his combination, in a Break, or staggered. Otherwise he turns it aside. |
| Dodge | Touch the left or right side of the screen | Sideways slashes must be dodged *against* the blade's travel. Overhead blows can be dodged either way. Thrusts can't be dodged. |
| Block | Hold the shield | Stops anything, but each block spends one of the count shown on the shield. They come back over time. You can't swipe while blocking. |
| Parry | Swipe *against* the blow as the glint flares white | Turns the blow aside and fills his stagger meter. Inside a combination it is only a clash: he fights on, a beat late. Swipe up against an overhead, left against a left-to-right slash, and sideways against a thrust. A **red glint** (and a blade lit red) can't be parried. |
| Perfect block | Raise the shield at the last instant | Spends nothing and fills his stagger meter twice as fast. |
| Riposte | After a parry that ends his combination, swipe the way the white chevron flashes | Double damage on the first cut. |
| Break | Answer **every blow** of a combination (dodge, block or parry) | He is thrown open for a long moment: about 2.5 s, or 3.5 s if you parried every blow. This is where you land your flurry. A blow that lands on you, or a spent shield, forfeits it. |
| Super | Tap the star when it lights | Stuns him and doubles your damage for a moment. |

- Parries, perfect dodges and blocks fill his **stagger meter** (the thin gold line under his health). When it fills, he's open for two seconds and takes extra damage.
- **Perfect dodges and blocks** (at the last instant) fill his stagger meter faster. They don't cut his combination short: defend through the whole chain for the Break.
- **Known strikes:** a strike sequence in one opening earns a heavy bonus blow. In the tutorial and your first two duels, gold chevrons walk you through one while he is open; after that the sequences are yours to remember (they're listed in camp and in the Book of Arms).
- **The finishing blow** plays in slow motion while the crowd roars. Some foes don't stay down.
- **Bloodline:** when you fall, your son takes up the oath with your gear and experience, and the run starts over. Beating the Green Knight starts a harder cycle.
- New swords and shields unlock at generation milestones. Choose your gear in camp (the title screen).

The first duel is a guided tutorial.

**Keyboard (desktop):** arrow keys strike in their direction (press two together for a diagonal, or use the numpad for all eight), **A / D** dodge, hold **S** or **Space** to block, **W** or **Enter** for the super, **Esc** or **P** to pause. In camp, **Enter** rides out, **← →** change sword and **↑ ↓** change shield; the camp screen's footer carries these tips. Dragging with the mouse also swipes.

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

Armour reference for the knights: English harness c.1370-1400 (the Black Prince's effigy at Canterbury, the Churburg armour, Gawain's arming in *Sir Gawain and the Green Knight*), with the Saxon raider after 6th-century finds. There's no build step: it's plain ES modules plus Phaser 3.80.1 from cdnjs. The `/3d/` page also loads Three.js 0.160.0 from jsDelivr (only on that page); `src/render3d/View3D.js` maps the same pose data onto toon-shaded 3D figures. All art and sound are generated in code; the only external asset is the Cinzel font from Google Fonts.

## Releasing

Bump `VERSION` in `service-worker.js` and push to `main`. GitHub Pages redeploys automatically, and installed copies pick up the new version on their next launch.

**Menu music:** "Wendale Abbey" by Yubatake (CC BY 4.0, https://opengameart.org/content/wendale-abbey), converted to MP3 (`assets/audio/`). **Loading and menu image:** the Sacra di San Michele above the clouds (`assets/art/loading.jpg`), supplied by the project owner.

**Sound clips:** steel on steel from "Medieval sound effects - Weapon impacts" by Ben Jaszczak & Brian Nelson (CC0, https://opengameart.org/node/146863); armour, shield, footsteps, cloth and pages from Kenney's Impact Sounds and RPG Audio (CC0, https://kenney.nl). Trimmed and converted in `assets/audio/sfx/` (see its CREDITS.txt). Voices, crowd, whooshes and the duel music are still synthesised.

**Music:** duels, "Heroic Demise (updated)" by Matthew Pablo (CC BY 3.0); the Green Knight and last stands, "Epic Boss Battle" by Juhani Junkala (CC0); menus, "Wendale Abbey" by Yubatake (CC BY 4.0), all from OpenGameArt.org. **Other sounds:** crowd cheering by Gregor Quendel (CC BY 4.0) and CC0 recordings by Still North Media, Vehicle, HaelDB, thebardofblasphemy, StarNinjas, bart, qubodup and Kenney. Full list in `assets/audio/CREDITS.txt` and `assets/audio/sfx/CREDITS.txt`.
