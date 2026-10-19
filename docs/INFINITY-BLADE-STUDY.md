# Infinity Blade II: overlays and timing

Studied frame by frame (0.2 to 0.5 s steps) from a full-game walkthrough on YouTube
(<https://www.youtube.com/watch?v=_ppHAA1OVak>, PC build). Two fights in detail: the tutorial
duel (3:25 to 4:05) and a mid-game boss (25:45 to 27:00).

## What the screen shows

**At rest:**
- A thin blue health bar for you and a thin red one for him, across the top and joined by a small
  emblem in the middle. His health is shown as a number at the far right.
- Two dodge chevrons, ghosted, at the bottom-left and bottom-right edges.
- The shield button at the bottom centre carries a number (the blocks left).
- Two round magic and super icons in the top corners.
- Everything is pale and see-through. No banners or prompts.

**The camera:**
- Over your shoulder and close: the foe fills a third to half of the screen.
- After the boss's mid-fight cutscene the camera stays wider and tilted (a Dutch angle) for the rest
  of the fight.

**His attacks:**
- No telegraph markers at all: no rings, glints or arrows.
- The wind-up pose is the whole tell: big, slow, clearly one-sided. He winds up for about 0.5 to 1 s
  and attacks every 1.5 to 2 s in combinations.

**Callouts** ("DODGE", "BLOCKED", "PARRY", "WIND HIT", "STAB"):
- One word, small (about 4% of screen height), thin, in all caps.
- Light cyan, but red for "BLOCKED" (his block, or yours being broken).
- They sit at the top centre, just under the health bars and away from the fighters.
- Each shows for about 0.5 to 1 s, then fades. Only one at a time, and the newest replaces the last.

**Parry, in two stages:**
- 0.2 s: a large white starburst with blue-white blade-like spikes, right where the blades meet
  (about a third of the screen).
- Then about 0.2 s of thin white speed lines radiating from that point while he's thrown back.
- "PARRY" appears about 0.2 s before the flash.
- He recoils with his arms flung wide: a huge, readable pose.

**Parry break:**
- Single parries inside his combination ("GREAT PARRY") don't stop it: he carries on attacking.
- Parrying through to the end of the combination gives "GREAT PARRY BREAK!!", with small stars by
  his health bar. That opens him for about 3.5 s.
- Then he blocks your next cut ("BLOCKED" in red), and the opening is over.

**Dodge:**
- Understated: the chevron lights, the hero steps or rolls, and "DODGE" fades.
- No flash and no slow motion.

**Your hits:**
- Very bright, wide white-blue light trails that run the length of the swipe, often across most of
  the screen.
- About four hits a second during an opening, each with a one-word callout and his health number
  ticking down. No big floating damage numbers.

**Finish:**
- A stab with radial white lines.
- A white flash over the whole screen.
- About 2 s of slow motion on the final stroke, with "FINISHING BONUS".
- A full white fade with "VICTORY!", then a low-angle shot of the hero.

**Boss phase change:** the HUD disappears completely for a short cutscene (about 5 s), and the fight
then resumes with the new camera.

## Logres compared

| | Infinity Blade II | Logres now |
|---|---|---|
| Telegraph | The pose alone | Gold glint and an approach ring that closes; dashed red ring with ✕; DODGE!/NO DODGE tags |
| Callouts | One small cyan word at the top centre, about 0.6 s, one at a time | Large gold words (54 px, heavy stroke) at mid-screen, often several at once, plus banners |
| Parry effect | Starburst at the contact point, then radial lines | Gold clash sparks, a gold screen flash, a slow-motion beat |
| Parry reward | A combination must be parried through to break him (about 3.5 s open) | Each parry opens him for 0.9 s, with a riposte arrow |
| Your blows | Huge bright trails | Thin gold trails; damage numbers |
| HUD | Pale, thin, out of the way | Solid gold roundels, parchment bars, key hints |
| Finish | White flash, 2 s slow motion, white fade | Kill cam |

## What to take (proposed brief 28)

Logres is aimed at new players, so its telegraph markers have earned their place: the tutorial and
lessons rely on them. Infinity Blade's lesson is restraint everywhere else.

1. **Quieter callouts:**
   - One short word at a time, smaller and lighter, at the top centre under the bars.
   - A newer one replaces the older.
   - Gold for your successes, red for his. Keep the big centre text for rare moments only:
     "Disarmed!", Pendragon, Victory.
2. **A parry flash at the point of contact:** a white starburst with spikes, then radial speed lines.
   This replaces the full-screen gold wash.
3. **Brighter, wider blade trails** on your cuts during openings.
4. **Ghost the HUD at rest:** roundels and bars about 60% opaque, brightening when used or needed.
5. **Optional, a setting:** "Read his blade". It fades the rings and glints out after the first two
   foes, so the poses carry the telegraph, as in Infinity Blade.
6. **The finishing blow:** a white flash and a white fade into Victory after the kill cam.

Not proposed: the parry-break rule (a full combination to open him). Logres's per-parry riposte and
the three-parry disarm already reward parrying, and changing it would undo the difficulty tuning
from brief 21.
