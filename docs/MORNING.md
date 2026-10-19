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

## Brief 4, moments (v20)

`docs/BRIEF-04-moments.md`

- **Blade lock:** parry at the very last instant (the final 70 ms) and the blades bind. The camera
  swings into a tight two-shot, both knights lean in, and a strength bar appears. Tap anywhere (or
  press any key) to drive him back. Win and he's **Overpowered!** and staggered; lose and he forces
  you down for a light cut.
- **Where it came from:** when a blow lands on you, the edge of the screen it came from flashes red.
- **Last stand:** at 30% health every foe (except the Green Knight, who has his own second phase)
  roars and fights on, faster and with shorter pauses.
- Bot check: all five duels completed, including a won and a lost lock, no errors.

## Brief 5, the sound of the hall (v21)

`docs/BRIEF-05-sound.md`

- **Music, made in code:** a drone, a harp improvising in an old church mode, and a drum that builds
  from a heartbeat to a war-march. It's calm in camp, steady in the duel, and faster and denser in a
  last stand or blade lock. Victory gets a horn call; defeat goes silent. Turn it off under Music, in
  camp or the pause menu.
- **The crowd** murmurs through every duel, cheers your parries and gasps when you're hit.
- **Heavier steel:** parries ring longer and land with a thud; clangs knock and vary.
- **Low health:** you hear your heart, faster as you weaken.

## Brief 6, read his guard (v22)

`docs/BRIEF-06-read-his-guard.md`

- **High guard / low guard:** while he waits, he holds his blade high (open to a horizontal cut, ← or
  →) or low (open to a vertical cut, ↓ or ↑), and shifts every couple of seconds. A faint arrow at his
  shoulders shows the gap. A cut through it gets in for half damage ("Through his guard!"); he changes
  guard at once and attacks sooner. Anything else still clangs, and two clangs still earn his
  counter-cut. The Green Knight's axe has no such guard.
- **Gawain's own moves:** the dodge is now a crouched side-step with the shoulders turned away and the
  shield up. Blows throw him back and twist him with their direction, and a block braces him with a
  half step back.

## Brief 7, phone-ready (v23)

`docs/BRIEF-07-phone-ready.md`

- **Loading screen:** a gold progress bar and what's happening ("Arming Sir Gawain…") while the
  knights download.
- **Colour-blind safe:** blows that can't be parried now have a dashed, turning ring and a ✕, not just
  a red one.
- **Graphics: High / Medium / Low** in the pause menu. It takes effect at once, is remembered, and
  stops the automatic step-down from overriding your choice.

## Brief 8, entrances and exits (v24)

`docs/BRIEF-08-entrances-and-exits.md`

- **The challenge:** each duel opens on a wide, high view of the hall that sweeps down behind Gawain as
  his foe walks in and issues his challenge. The Saxon beats his axe on his shield, the Black Knight
  salutes, the Brigand points his falchion at you, the Red Knight raises his sword, and the Green
  Knight spreads his arms and laughs. The crowd stirs.
- **Your fall:** slow motion, the HUD clears, the music drops away, the crowd gasps, and the camera
  swings round to face Gawain as he goes down.
- The tutorial still flows (bot-checked), and all duels pass.

## Brief 9, weapons with weight (v25)

`docs/BRIEF-09-weapons-with-weight.md`

- **Swing styles:** axes (the Saxon, the Green Knight) coil deeper, lean further and follow through
  with the whole body; the Brigand's falchion flicks with short, snapping cuts; the knights' swords
  stay formal. The timing of each blow is unchanged; only how it looks differs.
- **He blocks you, visibly:** when your swipe clangs off his guard, he takes it on his raised shield,
  or crosswise on his blade if he has no shield.

## Brief 10, coherence pass (v26)

`docs/BRIEF-10-coherence.md`, results included.

- **Lessons wait their turn:** urgent ones show at once; the rest queue for a quiet moment and never
  cover an incoming blow.
- **Difficulty re-tuned from a fresh save:** fights were far too short (the Saxon fell after one of
  his own blows). Foes now have more health and the Green Knight hits harder. Duels run about 12 to
  40 seconds, and the Red Knight can now kill a careless knight.
- **Portrait fixes:** the blade-lock camera keeps both knights whole on a narrow screen, and blade
  trails switch off while blades are bound.
