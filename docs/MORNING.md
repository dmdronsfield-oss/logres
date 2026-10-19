# Good morning: what changed overnight

Live at https://dmdronsfield-oss.github.io/logres/side/ (release v17). The brief I worked from is
`docs/OVERNIGHT-BRIEF.md`.

## The surprise

Land the final blow on anyone and the duel ends as a short film: slow motion, the camera swings round to
watch him fall, the galleries roar and throw rose petals and gold leaf. Then beat the Green Knight (round 5)
and see what he does. It's straight out of the poem.

## Reading the fight

- **Approach ring:** every blow now has a ring that closes on the gold glint and lands on it at the moment
  of impact. It turns **white** while the blow can be parried (red for blows that can't).
- **Path arrow:** a dotted arrow shows which way the blade will travel, so you know which way to parry
  or dodge.
- **Release:** he winds up further and holds at the top, then releases the blow just before impact with
  a whoosh, so his blade visibly meets your parry.
- **Blade trails** on both knights, gold for his blows and red when they can't be parried.
- **Open glow:** a gold shimmer on him whenever he's open: the moment to strike.

## New moves

- **Perfect block:** raise the shield at the last instant. It costs no shield pip, fills his stagger
  meter and breaks his attack.
- **Counter:** a perfect dodge or perfect block cuts his combo short and leaves him open.
- **Riposte:** after a parry, a white arrow shows the return cut. Swipe along it for double damage.
- **Known strikes, shown:** while he's open, gold arrows walk you through one of the strike sequences
  from the title screen. Finish it for the bonus blow.
- Each of these is explained once, the first time it comes up after the tutorial.

## Drama

- A beat of slow motion on parries and perfect dodges; your own sword arm keeps real time, so swipes
  aren't lost during it.
- He sinks back to load and lunges in to strike. He's driven back when you parry or hit him, and his
  knees buckle when he's staggered.
- You step into your cuts and recoil off his guard.
- The camera creeps in as he winds up, punches in on your hits and jolts when you're struck.

## Portrait

The side view now plays upright too. The tourney bar becomes two rows, the roundels sit along the
bottom, and the camera frames both knights in the tall screen. The title, victory, defeat and pause
screens have upright layouts. Turn the phone and the game rebuilds in the other layout; your progress
is kept between duels, but a duel in progress restarts. The 2D and first-person pages still ask you to
turn the phone sideways.

## Keyboard

- **Arrows** strike (two together for a diagonal; the numpad gives all eight).
- **A / D** dodge, hold **S** or **Space** to block, **W** or **Enter** for the super, **Esc** or **P** to pause.
- In camp: **Enter** rides out, **← →** change sword, **↑ ↓** change shield.
- Key hints appear on the roundels, and the tutorial speaks in keys.

## How it was tested

- A script-driven bot played the tutorial and all five duels, including the Green Knight's ending, with
  no errors, in landscape.
- The portrait layout, riposte arrows and finishing blow were checked on a phone-sized screen. The 2D
  game still runs with the shared changes.
- One real bug found and fixed on the way: in the tutorial, a dodge started a moment before the parry
  prompt could leave you stuck.

## What I'd like you to judge

- **Difficulty.** The new rewards (counters, ripostes, visible strikes) make fights quicker. A bot can't
  tell me how it feels in the hand. If it's too easy, the knobs are in `src/config.js` (`block.perfectMs`,
  `counter.openMs`, `riposte.damageMult`, the combo damage) and in each enemy's health in
  `src/combat/enemies.js`.
- **The approach ring and arrows.** Are they helpful, or too much on screen? They're easy to tone down.
- **Portrait framing** on your actual phone.

Not done: in-game credits for INKXO's armour (still credited in the README), and new enemy models.

---

## Since then: brief 2, smarter foes (v18)

`docs/BRIEF-02-smarter-foes.md`

- **No more mashing:** swipe twice at his guard and he answers at once with a quick counter-cut
  ("His counter!"). It can still be parried or dodged.
- **Saxon raider: shield bash.** He draws his shield back and charges. It can't be parried, and it
  goes straight through a raised shield ("Guard broken!"). Only a dodge works. The ring is red and
  tagged **DODGE!**
- **Black Knight: hesitation strike.** He stops at the top of his wind-up. The approach ring stalls
  and flickers too, so a patient eye still reads it.
- Thrusts are tagged **NO DODGE** under the ring.
- Your own blade trail is fainter (it was flaring across the screen), and the landscape banners sit
  lower so they don't cover his blows.
- Bot check: all five duels completed by a deliberately imperfect bot, no errors.

## Brief 3, worthy opponents (v19)

`docs/BRIEF-03-worthy-opponents.md`

- **The Black Knight** now wears INKXO's full harness in blackened steel with silvered edges and a
  black plume, and carries his own cross shield.
- **The Red Knight** wears it in red lacquer with gilt edges and a red plume.
- Both are driven by the same motion as Gawain. The Saxon, the Brigand and the Green Knight stay
  code-built; they aren't plate knights.
- The gold "open" shimmer is softened on dark armour.
- **Performance:** two detailed knights on screen take about 2 ms a frame on this Mac, about 600k
  triangles counting the floor reflection and shadows. Phones will feel it more; the game's automatic
  quality step-down (bloom, then reflections) is there if they need it.
