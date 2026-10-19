# Trial: a sword animation library

You asked whether a library of sword-fighting animations could help, then: "go ahead and try it out".

## What was tried
- **Library:** Quaternius **Universal Animation Library 2** (Standard), CC0, from
  <https://quaternius.itch.io/universal-animation-library-2>. Filed in `reference/quaternius-ual2/`
  (gitignored; not shipped).
- **Contents:** 43 clips. The sword-and-shield ones are `Sword_Regular_A/B/C` with recoveries,
  `Sword_Regular_Combo`, `Sword_Heavy_Combo`, `Sword_Block`, `Sword_Dash`, `Shield_Dash`,
  `Shield_OneShot`, `Idle_Shield_Loop`, `Idle_Shield_Break` and `Hit_Knockback`.
- **Retargeted onto INKXO's rig in Blender.** INKXO stands in an A-pose and the mannequin in a T-pose.
  Each of 22 mapped bones takes its source bone's world rotation relative to rest, parents first.
  Work file: `reference/ual2_trial.blend`. Frame sheets: `reference/quaternius-ual2/trial/`.

## What the frames showed
- The retargeting works: INKXO follows the clips cleanly.
- The clips are action-game moves:
  - `Sword_Regular_B` turns the whole body round to face the camera for the wind-up, then spins
    back for the cut.
  - `Sword_Regular_C` is a spinning, leaping combo.
- With the body's turn damped to a third, the cut still ends with the arm flung straight out to the
  side and the blade pointing away from the foe. In an over-the-shoulder duel that reads worse than
  our own clean arc (brief 30).
- The library also has no light longsword cuts in the free version, and nothing like a
  measured, squared-up fencing stance.

## Verdict
- **Not as a replacement for your swings.** The code-built swing is cleaner for this camera and keeps
  exact timing (contact at 85 ms).
- **Possibly useful for:**
  - the foes' hit reactions (`Hit_Knockback`) and shield bash (`Shield_OneShot`);
  - the guard-break stagger (`Idle_Shield_Break`);
  - idle breathing (`Idle_Shield_Loop`).
  These are body moves where motion capture adds weight and the blade path doesn't matter.
- **A better source for duelling:** a grounded motion-capture longsword or sword-and-shield set,
  such as Mixamo's free "Sword and Shield Pack" (needs your Adobe login to download) or a paid
  longsword pack. These are real performers in a fencing stance, rather than stylised game moves.
