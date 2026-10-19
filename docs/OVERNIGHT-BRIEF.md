# Overnight brief: make the duel great

Written 2026-10-19 for an unattended night's work on Logres (`/side/`, the Infinity Blade-style hall).
The owner's words: "The battle mechanics are critical. They are a good start. The animations need to be
more dramatic and readable. Make them great. Give me a surprise in the morning. Give the game portrait
mode also. And let it run on desktop with keyboard use."

## What "great" means here

A player should always be able to answer three questions at a glance:

1. **What is he about to do?** Direction, timing and whether it can be parried.
2. **What should I do about it?** Parry, dodge, or block, and which way.
3. **Did it work?** Every exchange ends in an unmistakable result: a clash, a dodge, a hit, a stagger.

Drama comes from contrast: stillness before speed, slow motion at the decisive moment, weight on every blow.

## Work list, in order

### 1. Desktop keyboard (small, unblocks testing)
- Arrow keys swipe in that direction. Two arrows together within 80 ms give a diagonal. Numpad 1-9 also
  works as eight directions.
- A / D dodge left / right. S or Space holds the shield. W or Enter fires the super. Esc or P pauses.
- Title and menus: Enter starts the duel, arrows change gear, Esc goes back.
- Show key hints on the HUD buttons once a key has been pressed (keyboard players only).
- Mouse drag still swipes; clicking buttons still works.

### 2. Battle mechanics (the critical part)
Keep the core (parry against the blow, dodge against its travel, block with pips, stagger, super) and add
depth that rewards reading the enemy:
- **Perfect block:** raising the shield within 150 ms of impact costs no pip and adds stagger.
- **Dodge counter:** a perfect dodge opens him for a short counter window ("Counter!").
- **Riposte:** after a parry, a gold chevron shows the opening; swiping it does bonus damage.
- **Visible combos:** while he is open, show the next step of a known strike sequence as a chevron,
  so combos are learnable rather than secret.
- **Clearer feedback:** every outcome gets its own sound, flash, camera move and text, consistently.
- Tune timings so the first two enemies teach, and the later ones test.

### 3. Dramatic, readable animation
- **Telegraph:** a bigger, distinct wind-up silhouette per direction, then a held beat at the top
  (anticipation), with the glint at the blade tip. Add a faint arc on screen showing the blade's path.
- **Strike:** fast release with a blade trail (a ribbon swept by the weapon), a short hit-stop on contact,
  and a directional camera kick.
- **Parry:** both blades clash, sparks in 3D, a brief slow-motion beat, his weapon thrown wide.
- **Your swings:** a blade trail along your swipe, a weight shift into the cut and a recoil on a clang.
- **Hit reactions:** stronger recoil in the direction of the cut; staggers buckle the knees.
- **Defeat:** a slow-motion finishing blow with the camera swinging round.

### 4. Portrait mode
- Remove the "turn your phone" wall; the manifest allows any orientation.
- A portrait layout: logical width 600, height from the screen's aspect. Re-lay the tourney HUD (top bar
  stacked), buttons along the bottom, camera pulled back with a taller framing so both knights fit.
- Title, victory, death and pause screens re-laid for portrait.
- Rotating the device mid-game reloads into the new layout (the run is saved per duel).

### 5. The morning surprise
Something the owner didn't ask for and will enjoy. Plan: a cinematic finisher (slow motion, the camera
orbits, the crowd roars and throws roses) on every final blow, and the Green Knight behaving as in the poem.

## Rules for the night
- Test every change in the lab and in a real duel (landscape, portrait, keyboard); check the console.
- Commit in small, working steps; push and bump the service worker at each milestone.
- Don't break the 2D game (`/`) or the other pages.
- Credit any third-party asset; add none with unclear licences.
- Leave a morning note (`docs/MORNING.md`): what changed, how to play, what to look at, what's unfinished.
