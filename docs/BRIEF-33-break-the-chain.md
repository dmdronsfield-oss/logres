# Brief 33: break the chain

Your question: how could the battle mechanic be more like Infinity Blade? The study
(`docs/INFINITY-BLADE-STUDY.md`) found the biggest difference was rhythm, not looks.

## Why it was like that
- A single parry ended his whole combination and opened him for 0.9 s with a riposte arrow
  (`CONFIG.parriedOpenMs`), and a perfect dodge or perfect block cut the chain short for 0.7 s
  (`CONFIG.counter.openMs`). Every opening was one or two cuts long, and the fight was a string of
  single exchanges: blow, answer, cut, blow.
- In Infinity Blade a parry inside a chain is only a clash and he carries on. Only defending through
  the whole chain breaks him, for an opening of about 3.5 s in which you land a flurry. The fight has
  a pulse: weather the storm, then make him pay.

## Work (every number in `CONFIG.chain`, `src/config.js`)
1. **The clash.** A parry inside his combination no longer ends it. The parry burst, sound, stagger
   and super gains are unchanged, but he is only knocked back: a new enemy state, `Clash`, holds his
   next blow back 150 ms beyond its usual gap (`clashDelayMs`), then the chain goes on. No riposte
   arrow mid-chain, and he is not open. The three-parries-in-a-row disarm still counts parries
   across the chain (its check was "is he parried" and is now "is he not staggered"); a disarm ends
   the chain wherever it falls, since his weapon is gone.
2. **The Break.** Each chain keeps a tally. Answer every blow (any mix of dodge, block and parry,
   perfect or not) and at the end of the chain he is thrown open for 2500 ms (`breakOpenMs`), or
   3500 ms if every blow was parried (`breakParriedOpenMs`). A blow that lands, or a blow on a spent
   shield, forfeits it. The Break shows as the big centre text "Break!" (as staggers do), his
   existing open glow, his stagger grunt and a chime, and a one-time lesson. When the last blow was
   parried he recoils as before and the riposte arrow applies to the first cut; otherwise he is left
   open as after an ordinary chain. In the 3D hall a long Break after a parry plays the recoil, then
   he hangs open and unsteady.
3. **The stagger meter** is unchanged and stays the longer escalation. A perfect dodge or perfect
   block still feeds it and keeps its callout, but no longer interrupts the chain (the counter
   branch in `Enemy.afterStrike` is gone, with `CONFIG.counter` and the "Counter" callout and
   lesson).
4. **Single-blow chains** break on their one blow, so the Saxon opens on every parry (3.5 s) or
   dodge (2.5 s). The tutorial's scripted lessons never Break and keep their own openings, so the
   tutorial is unchanged; the free fight at its end teaches the Break.
5. **Chains answered in part** end as before: a parry on the last blow gives the ordinary 0.9 s
   parried opening with the riposte arrow; otherwise the foe's `recoverMs`.
6. **Opening limits** stay. The Brigand's and the Red Knight's cut limits go from 3 to 5, so a Break
   allows five cuts before he slips away or turns the blade (the Green Knight's second-phase limit
   of 4 is unchanged).
7. **Retune:** your base damage 20 → 16, and the known strikes' bonus blows 30/30/36 → 24/24/29, so
   a Break holds a sequence or two without them becoming the bulk of the damage (see Results).
8. **Book of Arms:** "The Break" replaces "The Counter"; "The Parry", "The Riposte" and "The Perfect
   Block" are reworded. The README's How to play table has a Break row.
9. **The test bot** (`tools/harness.js`) defends each blow as before and attacks whenever he is
   open, so it defends through whole chains and cuts through Breaks without change. It now holds
   its block until the blow has landed (it used to let go after 300 ms, sometimes before impact),
   and `campaign(duels, skill, { fresh: true })` runs the campaign check from a fresh save and
   prints the table per foe.

Not changed: a blade lock (a parry in the last 70 ms) still decides the exchange on its own; a win
staggers him and a loss forces you down, so the chain is over either way.

## Results

**Rule checks** (scripted chains with manual stepping, Black Knight unless named):

| Chain and answers | Result |
|---|---|
| slash, slash: parry, parry | Clash after the first (next blow 455–533 ms later, no riposte, not open); then "Break!", open 3500 ms, riposte arrow |
| slash, slash: perfect dodge, dodge | No interruption after the perfect dodge; "Break!", open 2500 ms |
| slash, slash: perfect block, parry | "Break!", open 2500 ms (not every blow parried), riposte arrow |
| slash, slash: hit, parry | No Break: parried opening 900 ms with the riposte arrow |
| slash, slash: block, hit / hit, dodge | No Break: his ordinary 950 ms recovery |
| slash, slash, overhead: parry ×3 | Clash, clash, then the third parry fills the stagger meter: "Staggered!" |
| next chain, first blow parried (4th in a row) | "Disarmed!" mid-chain, open 2600 ms |
| Saxon overhead: dodge / parry | "Break!" 2500 ms / 3500 ms with the riposte arrow |
| Brigand ×3 dodged, then a flurry | Break; 5 cuts land, the 6th makes him slip away |
| Red Knight ×2 perfect dodges, then a flurry | Break; 5 cuts land, the 6th he turns and answers with his counter-cut |

**Campaign check** (brief 21's method: a fresh save played straight through with real levelling and
the bloodline on death, bot skill 0.6). "Breaks / chains" counts his combinations that ended and how
many of them the bot answered in full.

Before (v59, 30 duels):

| Foe | Wins | Health left when won | Average duel |
|---|---|---|---|
| Saxon | 8/8 | 92% | 14 s |
| Black Knight | 6/8 | 55% | 26 s |
| Brigand | 5/5 | 54% | 23 s |
| Red Knight | 4/5 | 41% | 30 s |
| Green Knight | 2/4 | 33% | 30 s |

After (base damage 16, bonus blows 24/24/29, Brigand 340 → 300 health, Red Knight 440 → 500;
90 duels):

| Foe | Wins | Health left when won | Breaks / chains | Average duel |
|---|---|---|---|---|
| Saxon | 22/23 | 88% | 47 / 76 | 18 s |
| Black Knight | 18/22 | 44% | 42 / 107 | 29 s |
| Brigand | 16/18 | 56% | 31 / 86 | 29 s |
| Red Knight | 11/16 | 37% | 43 / 112 | 36 s |
| Green Knight | 6/11 | 39% | 48 / 69 | 38 s |

The curve still rises towards the finale (brief 21's target was 95 / 85 / 75 / 60 / 45): the Green
Knight is the hardest, the Red Knight next, and the Black Knight and the Brigand are within the noise
of each other. The bot answers about six blows in ten, so it breaks the Saxon and the Green Knight
(single blows) on most chains, the Black and Red Knights (two blows) on four in ten, and the Brigand
(three and four blows) on a third.

How the numbers were found:

| Run | Base damage, bonus blows, health | Saxon | Black | Brigand | Red | Green | Average duel by foe |
|---|---|---|---|---|---|---|---|
| A (30 duels) | 12, 30/30/36, as before | 9/9, 90% | 6/9, 69% | 5/6, 35% | 2/4, 81% | 2/2, 35% | 16 / 27 / 32 / 35 / 38 s |
| B (60 duels) | 12, 18/18/22, as before | 15/15, 86% | 12/14, 50% | 10/12, 42% | 9/10, 51% | 4/9, 48% | 19 / 35 / 38 / 37 / 42 s |
| C (90 duels) | 16, 24/24/29, as before | 22/23, 87% | 20/22, 51% | 14/20, 52% | 12/13, 46% | 6/12, 63% | 19 / 30 / 31 / 34 / 32 s |
| D (90 duels, kept) | 16, 24/24/29, Brigand 300, Red 500 | 22/23, 88% | 18/22, 44% | 16/18, 56% | 11/16, 37% | 6/11, 39% | 18 / 29 / 29 / 36 / 38 s |

- The "seven cuts per Break" arithmetic pointed at a base damage near 12, but a Break also lengthens
  the whole exchange (storm, then flurry), so the damage dealt per second barely rises with it, and
  at 12 the duels ran a third longer than before (run B). 16 keeps them within about a fifth.
- Lowering the known strikes' bonus blows with the base damage keeps them a bonus: in run A, with
  the old 30/30/36, the bot finished a sequence or two in every Break and they made up nearly half
  its damage.
- With base damage 16 the Black and Red Knights, whose short chains Break often, were too easy, and
  the Brigand, whose long chains the bot rarely answers in full, had the longest duels (run C).
  Lowering the Brigand's health and raising the Red Knight's put the order back (run D).
- Duels are still 3 to 8 s longer than before. That is the rhythm itself: his combinations run their
  course, and the flurries are longer. Foe health is the lever if you want them shorter.

## Checked
- Rule checks above, in `/side/`, with no console errors; the Book of Arms shows "The Break".
- The tutorial with the bot from a fresh save: intro → dodge → strike → block → strike2 → parry →
  strike3 → free, won, `tutorialDone` set.
- The 2D page (`/`): loads with no console errors; a scripted parry, parry chain gives the clash
  (the recoil pose, then guard) and the Break; the bot fights the Black Knight for ten seconds
  without errors.
- Not released: no service-worker VERSION bump. The owner reviews and merges this branch.
