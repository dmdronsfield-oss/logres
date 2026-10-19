# Brief 24: fresh eyes

Twenty-three briefs have each added something on its own. This one plays the whole game through as
a new player would, from an empty save, and fixes whatever reads badly when it's all together.

## Work
- **Two playthroughs from a fresh save:** a phone held upright (portrait, 390×844, touch), and a
  laptop with the keyboard only. Title, the tutorial duel, every foe to the Green Knight, a death,
  victory screens, the Book of Arms, the pause menu.
- At each step, take a screenshot and check: is the text readable at that size; does anything
  overlap or run off the edge; does the next thing to do read clearly; does a keyboard player ever
  meet a prompt that only talks about tapping or swiping.
- Fix what turns up: layout, wording, prompts, order of lessons. Small fixes only; anything bigger
  becomes the next brief.

## Done when
A list of findings and fixes is recorded here, with before and after screenshots of the worst ones;
the bot passes; release published.

## Findings and fixes

Played from an empty save on a 390×844 phone held upright, then at 1280×800 with the keyboard only.

| Where | Finding | Fix |
|---|---|---|
| Camp, both layouts | The last line ("Next: Kite of Logres…") sat on the panel's border; in landscape the selector arrows overlapped the stats line | Gear panel 20px taller, shield selector lower, arrows moved outward, stats reworded shorter ("Timing 100%", "one back every 4.0s") |
| Camp, phone | Sound/Music/Buzz/Lefty toggles about 26pt tall, under a comfortable touch size | 50 high on phones |
| Pause menu, phone | Buttons about 27pt tall, bunched in the middle of a tall screen | About 40pt tall and wider, spread over the screen |
| Victory, phone | Everything bunched in the top third; half the screen empty; long stats line | Stats on two lines; text block lower; Onward (large) and To camp stacked near the thumb |
| Book of Arms, new player | Fourteen identical "Sealed" rows | Each sealed entry shows its name, greyed ("The Riposte · sealed") |
| Lessons, keyboard | Riposte, thrust, super and known-strike lessons spoke only of swiping and tapping | Keyboard wording when a keyboard is likely ("press W (or Enter)", "press ← or →"…) |
| Death, keyboard | "Tap to take up the sword" | "Press Enter to take up the sword" with a keyboard |

Fine as they were: the tutorial (already worded for both), the duel HUD in portrait, the death screen
in portrait, keyboard hints in the duel.

Tooling: `tools/devserver.py` serves without caching and withholds the service worker, so edits show
on reload during testing (`python3 tools/devserver.py 8081`).

Bot (skill 0.8) after the changes: beat the Saxon, Black Knight and Brigand; no console errors.
