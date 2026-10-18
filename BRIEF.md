# Brief: "Logres" — 2D swipe-duel sword-fighting game for mobile browsers

## 1. Goal

Build a 2D, one-on-one sword-fighting game that plays in a mobile browser (iPhone Safari and Android Chrome) with no installation, hosted free on GitHub Pages. The combat follows the Infinity Blade model: swipe to attack, dodge, block and parry against telegraphed enemy attacks, with a bloodline loop on death. The setting is Arthurian Britain.

The finished game must open from a URL on a phone, be playable in under ten seconds, and be addable to the home screen as an app.

Work milestone by milestone (section 12). Commit after each milestone with a clear message. Do not start the next milestone until the current one meets its acceptance criteria.

## 2. Hard constraints

- **Static site only.** No server, no database, no accounts. Everything runs client-side.
- **No build step required to run.** Plain HTML, CSS and ES modules. Phaser 3 loaded from a pinned CDN URL (cdnjs or jsdelivr). If you believe a build step (Vite) is necessary, justify it and add a GitHub Actions workflow so deployment stays automatic.
- **No third-party art, sound or fonts with unclear licences.** Draw all graphics in code (Phaser Graphics / generated textures). Generate sound with the Web Audio API. One Google Font is permitted.
- **Original IP.** Do not use the names, logos, characters, UI art or assets of Infinity Blade or Epic Games anywhere in the code, text or repo. The mechanics are the reference; nothing else is.
- **Performance:** steady 60fps on a mid-range phone from 2021 onwards. Total page weight under 2MB excluding the Phaser library.
- **Landscape play.** In portrait, show a full-screen "Turn your phone" overlay with a rotating icon.
- **Touch first.** Every action works by touch. Mouse and keyboard support is a bonus for desktop testing only (arrow keys dodge, space blocks, mouse drag swipes).

## 3. Repo structure

```
/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── icons/                 (generated PNGs: 192, 512)
├── src/
│   ├── main.js            (Phaser config, scene list)
│   ├── config.js          (ALL tunable numbers live here)
│   ├── input/SwipeInput.js
│   ├── combat/Fighter.js
│   ├── combat/Player.js
│   ├── combat/Enemy.js
│   ├── combat/enemies.js  (enemy definitions as data)
│   ├── combat/CombatDirector.js
│   ├── fx/Juice.js        (hit-stop, shake, flash, slow-mo)
│   ├── audio/Sfx.js       (Web Audio generated sounds)
│   ├── scenes/Boot.js
│   ├── scenes/Title.js
│   ├── scenes/Duel.js
│   ├── scenes/Victory.js
│   ├── scenes/Death.js    (bloodline succession)
│   └── save/Save.js       (localStorage, wrapped in try/catch)
├── README.md
└── BRIEF.md
```

## 4. Deployment

1. Repo is public on GitHub.
2. Enable GitHub Pages: Settings > Pages > Deploy from branch > `main` / root.
3. Game is live at `https://<username>.github.io/<repo>/`.
4. All asset paths must be relative so they work under the `/<repo>/` subpath.
5. Add PWA manifest and a simple cache-first service worker so the game can be added to the home screen and opens full-screen without browser chrome. Bump the cache version on each release.
6. README must include the live URL, how to play, and how to run locally (`npx serve .` or `python3 -m http.server`).

## 5. Core combat mechanics (Infinity Blade model)

### 5.1 Layout (landscape)

- Enemy centre-screen, large, facing the player.
- Player shown as an over-the-shoulder sword arm and shield at the bottom edge (first-person feel).
- **Dodge buttons:** bottom-left and bottom-right corners.
- **Block button:** bottom-centre (shield icon), shows durability pips above it.
- **Swipe area:** the whole upper two-thirds of the screen.
- **Super button:** top-left, lights when the meter is full.
- **Health bars:** player bottom, enemy top.

### 5.2 Player actions

| Action | Input | Rule |
|---|---|---|
| Attack | Swipe in any of 8 directions | Deals damage only when the enemy is Open (Recovering or Staggered). During other states the enemy blocks it with a clang and no damage. |
| Dodge | Tap left or right dodge button | Unlimited use. Avoids an attack only if the dodge direction is correct for that attack (see 5.4). Takes ~350ms during which the player cannot act. |
| Block | Hold block button | Stops any attack. Each blocked hit costs 1 durability pip. Shield has 3 pips, regenerates 1 pip per 4s when not blocking. At 0 pips, block fails. |
| Parry | Swipe *against* an incoming attack within the parry window | Cancels the attack, adds a large chunk to the enemy's stagger meter, triggers clash effect. A parry swipe must be roughly opposite in direction to the enemy's attack direction (±45°). |
| Super | Tap super button when meter full | Instant stagger on the enemy for 2.5s plus a damage bonus. Meter fills from successful defence and hits. |

### 5.3 Swipe detection

- Pointer down to pointer up.
- Valid swipe: travel ≥ 40px (scale by device pixel ratio) and duration ≤ 350ms.
- Snap angle to 8 directions (N, NE, E, SE, S, SW, W, NW).
- Draw a gold trail along the swipe path that fades over 200ms.
- A swipe that fails the thresholds does nothing.
- Multi-touch: holding block with one thumb while swiping with the other is not allowed (block takes priority, swipes ignored while held).

### 5.4 Enemy attacks

Each attack is defined as data:

```js
{
  id: 'overhead',
  telegraphMs: 600,      // wind-up, clearly visible
  direction: 'S',        // direction the blow travels on screen
  dodge: ['left','right'], // which dodges avoid it
  parryable: true,
  damage: 18,
  recoverMs: 800          // enemy is Open afterwards
}
```

- Horizontal slashes (E or W) can only be dodged the opposite way to the blade's travel. Overheads (S) can be dodged either way. Thrusts can only be blocked or parried. Some heavy attacks are unparryable (red glow during telegraph).
- Telegraph must be readable: the enemy's weapon winds up and a gold glint appears at the start point of the strike. Unparryable attacks glint red.
- **Parry window:** final 180ms before impact (config value).
- **Combos:** enemies chain 1 to 4 attacks with short gaps (150 to 400ms) before Recovering.
- **Feints:** advanced enemies may start a telegraph and cancel it.

### 5.5 Enemy state machine

`Idle → Telegraph → Strike → (next in combo or Recover) → Idle`

- **Idle:** 500 to 1500ms, slight sway.
- **Recover:** enemy is Open; player hits land.
- **Staggered:** triggered when the stagger meter fills (from parries, perfectly-timed dodges and blocks). Enemy is Open for 2s, takes 1.5x damage. Meter resets.
- **Defeated:** fall animation, slow-motion final blow.

### 5.6 Player hits and combos

- Each successful swipe during an Open window deals base damage.
- Rapid successive hits (within 250ms of each other) build a hit counter shown on screen.
- **Swipe combos:** a short defined sequence of directions (e.g. `E, W, S`) completed during one Open window triggers a bonus strike. Define 3 combos in config; show the known combos in a small tooltip on the title screen.

### 5.7 Player state

`Ready, Attacking, Dodging, Blocking, Stunned, Dead`. Taking an unblocked hit stuns for 300ms.

## 6. Bloodline loop

- On death, show the Death scene: the knight's shield hung in a chapel, text "The oath passes to his son. Generation N+1."
- The new knight keeps all gear and experience. The world resets to the first duel of the sequence.
- On a win, the run continues to the next enemy in the sequence. Beating the final enemy shows a victory screen and unlocks a harder "next generation" cycle with enemies at +20% health and damage.
- Track generation count and best run in localStorage.

## 7. Progression (keep simple)

- XP earned per duel. Level-ups add +5% max health and +3% damage.
- 3 swords and 3 shields unlockable by generation milestone. Swords vary in damage and swipe speed tolerance; shields vary in durability pips (3 to 5) and regen rate.
- Gear selected on the title screen. No shop, no currency.

## 8. Enemies (first release: five)

| # | Name | Character | Rhythm |
|---|---|---|---|
| 1 | Saxon Raider | Tutorial enemy | Single slow attacks, long recover |
| 2 | Black Knight | Steady duellist | 2-hit combos, one unparryable heavy |
| 3 | Brigand Captain | Fast | 3 to 4 quick slashes, short recover |
| 4 | The Red Knight | Feints | Cancels telegraphs, punishes early dodges |
| 5 | The Green Knight | Boss | Huge axe, slow unparryable sweeps mixed with fast thrusts, two phases at 50% health |

Each enemy is defined entirely in `enemies.js` as data (health, palette, size, attack list, combo patterns, idle range). Adding a sixth enemy must require no code changes.

## 9. Feel ("juice") — mandatory

All values in `config.js`.

- **Hit-stop:** 70ms freeze on a clean hit, 120ms on a parry.
- **Screen shake:** small on hits, larger on heavy blows taken.
- **Flash:** struck fighter tints white for one frame.
- **Clash sparks:** gold particle burst at parry point.
- **Slow motion:** 0.3x for 600ms on the killing blow.
- **Haptics:** `navigator.vibrate` on hit taken and parry, where supported (no-op on iOS, which is fine).
- **Damage numbers:** float up and fade.

## 10. Art direction (code-drawn)

- Style: late medieval illuminated manuscript. Flat shapes, ink outlines, gold, lapis blue, vermilion and parchment.
- Fighters built from layered shapes (torso, head, helm, arms, weapon) as a simple cut-out rig, animated with tweens. Each limb is a separate display object so poses can be tweened.
- Backgrounds: parchment gradient with a simple layered scene per enemy (forest, hall, winter chapel). A decorative manuscript border frames the screen.
- UI buttons: gilded roundels with simple icons.
- Text: one serif display font (e.g. "Cinzel" or "IM Fell English" from Google Fonts) with a system fallback.

## 11. Audio (Web Audio API, generated)

- Steel ring for parry, dull thud for block, short whoosh for swipes and dodges, low thump for hits taken, bell toll on victory.
- Audio context starts on first tap (browser requirement).
- Mute toggle on title screen, saved in localStorage.

## 12. Milestones and acceptance criteria

**M1. Skeleton and deploy**
- Phaser boots, landscape overlay works, title screen with Play button.
- Live on GitHub Pages and opens on a phone.
- Accept: URL loads on iPhone Safari and Android Chrome without errors in console.

**M2. Grey-box duel**
- Rectangles for fighters. Swipe detection with trail, dodge, block with durability, one enemy with one attack type, health bars, win/lose.
- Accept: a full duel can be won and lost by touch alone. All timings come from `config.js`.

**M3. Full combat model**
- Parry with directional check, stagger meter, combos for enemy, Open windows, super meter, player swipe combos.
- Accept: parrying feels distinct from blocking; staggering the enemy is clearly the best outcome.

**M4. Juice and audio**
- Everything in sections 9 and 11.
- Accept: with eyes half-closed, a parry, a block and a clean hit are each distinguishable by sound and feel alone.

**M5. Enemies and bloodline**
- All five enemies, run sequence, death and succession scene, XP, save/load.
- Accept: dying and continuing as the next generation works; progress survives a page reload.

**M6. Art pass and PWA**
- Cut-out rig fighters, backgrounds, border, icons, manifest, service worker.
- Accept: "Add to Home Screen" launches full-screen in landscape; game runs offline after first load.

**M7. Polish**
- Tutorial overlays on the first duel (prompts for swipe, dodge, block, parry), pause menu, settings (mute, vibration toggle, left-handed layout swap).
- Accept: someone who has never played can win the first duel without explanation.

## 13. Testing

- Test on real phones via the GitHub Pages URL after each milestone, not only desktop emulation.
- Add a hidden debug overlay (toggle by tapping the top-right corner five times) showing FPS, enemy state, current window timings and last swipe direction.
- Guard against iOS Safari quirks: prevent pull-to-refresh, double-tap zoom and text selection (`touch-action: none`, `user-select: none`, viewport `user-scalable=no`), and handle the safe-area insets on notched phones.

## 14. Out of scope (first release)

Multiplayer, in-app purchases, accounts, cloud saves, 3D, magic/spell system, open-world map, the court strategy layer. These may follow once the duel is proven fun.
