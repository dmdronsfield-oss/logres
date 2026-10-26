# Brief 34: quiet the screen

From the review of the side view against `docs/INFINITY-BLADE-STUDY.md`. Infinity Blade shows two thin
bars joined by an emblem, ghosted chevrons at the bottom edges, a shield with a count, and one small
word at a time; the pose is the tell. Logres's overlays had grown louder than its fighters: the glint,
closing ring and dashed arrow were the brightest things in the frame, an opening tinted the whole foe
gold with a chevron and a label on his chest, banners sat across both knights, the top bar was a
scoreboard an eighth of the screen high, and three gilt roundels covered the knights' feet. Visual and
HUD work only: the combat rules (and brief 33's parry-break) are untouched.

## Work and results

1. **Telegraph marker tiers.** Each foe declares `markers` in `enemies.js`, drawn by
   `Enemy._updateGlint` and `_drawRing`:
   - `full` (the Saxon, and always the tutorial): glint, closing ring, path arrow and the
     DODGE!/NO DODGE tags.
   - `ring` (the Black Knight): glint and ring; no arrow, no tags.
   - `glint` (the Brigand): the glint alone, gold or red, still flaring white in the parry window.
   - `window` (the Red and Green Knights): nothing during the wind-up (the pose is the tell), then the
     glint for the last 180 ms. An unparryable blow shows its red glint for the same last moments.
   - **Read his blade** (pause menu and camp, saved as `readBlade`) forces `window` for every foe. The
     hesitation's stall and flicker now apply to the glint as well as the ring, so the glint-only
     tiers keep the Black Knight's tell.
2. **No text in the fight zone.** The strike and riposte chevrons lost their labels ("Gawain's Sun
   1/3", "Riposte!"); the DODGE!/NO DODGE tags show only in `full`; the "Feint!" word over his head
   became a callout at the top; the keyboard tip line moved from the duel to the camp footer (the
   small A / D / S / W / Esc labels stay by the buttons). Banners and lessons sit in the band under
   the bars in both layouts. In portrait "above the roundels" would have crossed Gawain's legs (he
   stands bottom-left, behind the dodge chevron), so there too the banner sits under the bars, where
   the hall is empty. The tutorial's 92 px arrow glyph is now a ghost swipe stroke that sweeps across
   the middle of the swipe area and repeats.
3. **The opening.** The whole-body gold tint in `Hall3D.js` is replaced by a pool of gold light on the
   floor under him (an unlit blended disc, no shader cost; additive light vanished on the pale marble).
   It fades as the opening runs out, flickers before he recovers early, and is dimmer in comfort mode.
   The strike chevrons show only while fewer than three duels are won (the tutorial and two more,
   `CONFIG.hud.strikeHintWins`), then never; the riposte chevron is a 300 ms flash. The open bar under
   his health is gone from the tourney HUD (the pool carries it); the stagger meter is a thin gold line.
4. **Top bar.** Two thin bars (7 px, a lighter top edge) meeting at a small gold lozenge, draining
   towards the middle; yours blue on the left (white while the cheat is on), his red on the right;
   small crests at the ends. No names, no ten segments, no Round plaque: the entrance banner now reads
   "Round 3 of 5 · The Brigand Captain, of the Wirral road". Tapping your crest still toggles the cheat.
5. **Buttons.** Line art in a thin gold stroke over a soft shadow, no gilt disc: double chevrons for the
   dodges, a shield outline with the blocks left as a number (red at 0), a small star for the super
   that fills, glows and pulses when ready, two bars for pause. Hit zones are unchanged
   (`SwipeInput.addButton` radii); ghosting as in brief 28.
6. **One tier of word.** The big moments ("Staggered!", "Blade lock!", "Overpowered!", "Forced down!",
   "Disarmed!", the known strikes' names, "Strike of the Pendragon!") go through `Hud.callout` at 1.3×
   with a gold star at each side. `bigText` is kept for "Victory", "You fall…" and "The Green Knight
   rises…". Damage numbers are 60% of the old size, at the contact point, with a short float; no number
   over Gawain when he is hit (the red wash, edge flash and bar carry it).
7. **Also:** the Book of Arms has a new entry, "Reading his Blade", and its entries no longer promise
   rings, arrows or pips; the README's How to play follows; the camp's shield line says "blocks".
   The classic HUD on `/` and `/3d/` keeps its name text and open bar (the 2D figures have no glow);
   its banner moved from the foe's chest (236) to the band under the bars (120), which in the
   first-person framing still crosses the top of his helm.

### Screenshot pairs (`docs/overlays/`, 1280×800 and 390×844, from the harness)

| Moment | Landscape before → after | Portrait before → after |
|---|---|---|
| At rest | [before](overlays/before-L-rest.jpg) → [after](overlays/after-L-rest.jpg) | [before](overlays/before-P-rest.jpg) → [after](overlays/after-P-rest.jpg) |
| Parry window (Brigand) | [before](overlays/before-L-parrywindow.jpg) → [after](overlays/after-L-parrywindow.jpg) | [before](overlays/before-P-parrywindow.jpg) → [after](overlays/after-P-parrywindow.jpg) |
| Parry | [before](overlays/before-L-parry.jpg) → [after](overlays/after-L-parry.jpg) | [before](overlays/before-P-parry.jpg) → [after](overlays/after-P-parry.jpg) |
| Riposte (0.33 s after the parry) | [before](overlays/before-L-riposte.jpg) → [after](overlays/after-L-riposte.jpg) | [before](overlays/before-P-riposte.jpg) → [after](overlays/after-P-riposte.jpg) |
| An opening | [before](overlays/before-L-opening.jpg) → [after](overlays/after-L-opening.jpg), [after three wins](overlays/after-L-opening-wins3.jpg) | [before](overlays/before-P-opening.jpg) → [after](overlays/after-P-opening.jpg) |
| The red ring (Black Knight) | [before](overlays/before-L-redring.jpg) → [after](overlays/after-L-redring.jpg) | |
| A stagger | [before](overlays/before-L-stagger.jpg) → [after](overlays/after-L-stagger.jpg) | [before](overlays/before-P-stagger.jpg) → [after](overlays/after-P-stagger.jpg) |
| A hit taken | [before](overlays/before-L-hittaken.jpg) → [after](overlays/after-L-hittaken.jpg) | [before](overlays/before-P-hittaken.jpg) → [after](overlays/after-P-hittaken.jpg) |
| Tutorial: dodge prompt | [before](overlays/before-L-tut-dodge.jpg) → [after](overlays/after-L-tut-dodge.jpg) | [before](overlays/before-P-tut-dodge.jpg) → [after](overlays/after-P-tut-dodge.jpg) |
| Tutorial: strike prompt | [before](overlays/before-L-tut-strike.jpg) → [after](overlays/after-L-tut-strike.jpg) | |
| Tutorial: parry prompt (ghost swipe) | [before](overlays/before-L-tut-parry.jpg) → [after](overlays/after-L-tut-parry.jpg) | [before](overlays/before-P-tut-parry.jpg) → [after](overlays/after-P-tut-parry.jpg) |
| Comfort mode: parry | [before](overlays/before-L-comfort-parry.jpg) → [after](overlays/after-L-comfort-parry.jpg) | [before](overlays/before-P-comfort-parry.jpg) → [after](overlays/after-P-comfort-parry.jpg) |
| Comfort mode: opening | [before](overlays/before-L-comfort-opening.jpg) → [after](overlays/after-L-comfort-opening.jpg) | [before](overlays/before-P-comfort-opening.jpg) → [after](overlays/after-P-comfort-opening.jpg) |

After only: the blade lock ([after-L-lock](overlays/after-L-lock.jpg)); the Red Knight's `window`
tier mid-wind-up and in the window ([windup](overlays/after-L-redknight-windup.jpg),
[window](overlays/after-L-redknight-window.jpg)); the Green Knight's unparryable sweep
([windup](overlays/after-L-green-windup.jpg), [last moments](overlays/after-L-green-end.jpg)); the
Saxon with Read his blade on ([windup](overlays/after-L-readblade-windup.jpg),
[window](overlays/after-L-readblade-window.jpg)); the cheat's white bar ([after-L-cheat](overlays/after-L-cheat.jpg));
the pause menu ([after-L-pause](overlays/after-L-pause.jpg)); camp in both layouts
([landscape](overlays/after-L-camp.jpg), [portrait](overlays/after-P-camp.jpg)); the 2D page's tiers
([Saxon](overlays/after-2d-saxon-windup.jpg), [Black Knight](overlays/after-2d-black-windup.jpg),
[Brigand](overlays/after-2d-brigand-window.jpg), [Red Knight wind-up](overlays/after-2d-red-windup.jpg),
[Red Knight window](overlays/after-2d-red-window.jpg), [stagger](overlays/after-2d-stagger.jpg)).

## Checked
- Frame by frame on `/side/` with `tools/harness.js` (served by `tools/devserver.py`): the moments above
  in landscape (1280×800) and portrait (390×844), and in comfort mode. Every tier draws as declared for
  its foe; `Read his blade` forces `window` for the Saxon, survives in the save, and the tutorial still
  shows `full`. The cheat switch on your crest toggles and the bar turns white.
- The 2D page (`/`): each tier draws correctly (Saxon full, Black Knight ring, Brigand glint, Red Knight
  window), the classic HUD keeps its name and open bar. The `/3d/` first-person page was not driven.
- The bot (skill 0.85, fresh save) won the tutorial, then the Black Knight, Brigand, Red Knight and Green
  Knight in turn, through to the cycle turning (wins 5, generation 2), with no console errors.
- Not touched: the faint gap chevron over his shoulders (brief 6) is not a telegraph marker and stays as
  it was; the hit counter ("×3") stays at the right edge; no service-worker VERSION bump, nothing
  released.
