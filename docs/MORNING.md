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

## Brief 11, they fight back (v27)

`docs/BRIEF-11-they-fight-back.md`

- **Openings have limits for the better foes:** after 3 cuts in one opening the Brigand slips back
  out of reach. The Red Knight turns your 4th cut aside and answers at once ("He turns your blade!").
  The Green Knight does the same after 4 cuts in his second phase. Staggers ignore the limits.
- **Read it:** the gold "open" shimmer now fades as the opening runs out, and flickers when he's one
  cut from recovering. Three-step known strikes still fit inside the limit.

## Brief 12, the Green Knight (v28)

`docs/BRIEF-12-green-knight.md`

- The final foe now wears the detailed harness in green with gold edges, at 1.2× Gawain's size, with
  his antler crown, leaf cloak, great axe and holly. Everything else about him (phases, blows, the
  ending from the poem) is unchanged. In the poem he wears no armour; this is the romantic, armoured
  reading. Say if you'd rather he stayed unarmoured.

## Brief 13, contact (v29)

`docs/BRIEF-13-contact.md`

- **Hits land somewhere:** high cuts strike across his head and shoulders, level ones across his body,
  at a point along the blade's line, with sparks sprayed in the direction of the cut.
- **He reacts to where:** high cuts snap his head back and aside (the head now has its own spring);
  level cuts twist his trunk round.
- **Battle wear:** at two-thirds and one-third health a knight's armour darkens and dulls a step.
  Gawain's too.

## Brief 14, the Pendragon's strike and the arsenal (v30)

`docs/BRIEF-14-pendragon.md`

- **Strike of the Pendragon** (the super) is now a short cinematic: slow motion, the camera drops low
  and looks up as Gawain raises a blazing sword that lights the hall, then brings it down in a burst
  of gold. The crowd roars.
- **The arsenal shows:** Clarent is gilded and Excalibur's blade shines with a pale light (and leaves a
  brighter trail). The Kite of Logres is Gawain's lion heater, Pridwen a blue heater with gold crowns,
  and the Ash Targe a round wooden targe.

## Brief 15, animation review (v31)

`docs/BRIEF-15-animation-review.md`

- The lab now matches the game exactly (plate knights in INKXO's harness, swing styles, release
  timing) and has all the new moves.
- **Fixed a long-standing arm and leg bug:** the joint solver could fold an elbow the wrong way when a
  hand reached far and low. That's why shields flew up over heads during strikes. Hands now land
  exactly where they're aimed. It's worth a second look at the arms you disliked early on.
- Overhead blows now cut down and across, so the blade stays visible from Gawain's viewpoint;
  follow-throughs no longer rise after level cuts; shields stay forward in strikes.

## Brief 16, pose audit (v32)

`docs/BRIEF-16-pose-audit.md`

- A measuring tool in the lab (`__lab.audit()` in the browser console) plays every move of every
  knight and reports hands and feet that miss their marks, feet through the floor, hands inside the
  body and blades through heads.
- It found that follow-throughs aimed the sword hand up to 73 cm beyond arm's length, and that shield
  arms didn't turn with the body. Both are fixed; issues went from 41 to 11, all minor.

## Brief 17, comfort mode (v33)

`docs/BRIEF-17-comfort.md`

- **Comfort mode** in the pause menu: no screen shake or camera kicks, the cinematic cameras hold
  still, and flashes are softened. It's on automatically for anyone whose phone is set to reduce
  motion. All the motion added overnight made this worth having.

## Brief 18, the Book of Arms (v34)

`docs/BRIEF-18-book-of-arms.md`

- A **Book of Arms** button in camp (or press **B**) opens a parchment guide to all your arts and
  your foes' tricks, with what each is, how to do or answer it (touch and keys), and why it matters.
  Entries you haven't met yet stay sealed and open as you meet them in battle. It scrolls by drag,
  wheel or arrow keys, and works upright too.

## Brief 19, the last two foes (v35)

`docs/BRIEF-19-last-two.md`

- **The Saxon** now wears INKXO's mail hauberk (the plate and helmet stripped off) with leather
  leggings, under his own nasal helm and beard. **The Brigand** wears mail with a dark leather
  brigandine and his green hood. All five foes now share Gawain's detailed body and motion. Their
  heads are still the simpler code-built ones.

## Brief 20, pride and life (v36)

`docs/BRIEF-20-pride-and-life.md`

- **Life between blows:** foes rock their weight from foot to foot and reset their feet now and then,
  each at their own pace (the Brigand restless, the Black Knight still, the Green Knight slow).
- **Pride:** land two blows on Gawain in a row and the foe gloats with his challenge pose. He's open
  while he does it, and the crowd jeers. It gives a struggling player a way back. It's in the Book of
  Arms.
- Blade trails now only show during actual blows (they flared during gloats and stumbles).

## Brief 21, difficulty curve (v37)

`docs/BRIEF-21-difficulty-curve.md`

- Measured each foe with a test bot at the level a player would reach them. The Black Knight was
  easier than the Saxon, and the Red Knight was harder than the Green Knight. Retuned: the Black
  Knight hits harder, the Red Knight a little softer, and the Green Knight is now the toughest (more
  health, heavier blows). The curve now rises to the finale.

## Brief 22, voices and steel (v38)

`docs/BRIEF-22-voices-and-steel.md`

- **Battle cries:** each foe shouts as he winds up (always for heavy and unparryable blows), in his own
  synthesised voice: the Saxon gruff, the Black Knight muffled by his helm, the Brigand sharp, the Red
  Knight ringing, the Green Knight deep. He grunts when cut and cries out when staggered; Gawain
  grunts when hit.
- **Armour sounds:** cuts ring on plate, chink on mail and thud on leather, by foe.
- **Footfalls** on his lunges, and a scuff when you dodge.
- I couldn't listen to these myself (the code runs cleanly). Formant voices can sound robotic, so tell
  me if they grate and I'll tone them down or take them out.

## Brief 23, lighter on phones (v39)

`docs/BRIEF-23-lighter-on-phones.md`

- On **Medium and Low**, the knights now use a lighter copy of INKXO's armour with 30% of the
  triangles. It looks the same at fighting distance, and the rig and recolouring are unchanged.
  On Medium the capes also stay out of the floor reflection. Medium now draws about 140k triangles
  a frame, against 437k on High.
- High is unchanged. Phones that struggle already step down to Medium automatically, so they'll
  pick up the light model on their next launch.

## Brief 24, fresh eyes (v40)

`docs/BRIEF-24-fresh-eyes.md`

I played the whole game from an empty save twice: on a phone held upright, and on a laptop with the
keyboard only. Then I fixed what got in the way:
- **Phone:** bigger pause-menu and camp buttons. The Victory screen now puts Onward under your
  thumb. The camp's gear panel no longer clips its last line.
- **Keyboard:** the remaining lessons (riposte, thrust, Pendragon strike, known strikes) and the death
  screen now name keys rather than taps and swipes.
- **Book of Arms:** sealed entries show their names, so a new player can see what's still to find.

## Brief 25, he reads you (v41)

`docs/BRIEF-25-he-reads-you.md`

- From the Black Knight on, foes notice habits. Answer 4 of 5 blows the same way and he calls it
  ("He reads your dodge!"), then picks one of his own attacks that beats it. Always dodging left
  brings a cut you can only dodge right; always blocking brings a heavy blow; always parrying
  brings a feint. A player who varies their defence is rarely read. It's in the Book of Arms.

## Brief 26, the disarm (v42)

`docs/BRIEF-26-disarm.md`

- **Parry three blows in a row and his weapon spins out of his hand** and sticks point-first in the
  floor beside him. "Disarmed!" and a cheer. He's open for about 2.6 seconds, and can't slip away or
  counter, until he reaches over and takes it up again. It works for swords, the falchion and the
  Green Knight's axe. It's in the Book of Arms.

## Brief 27, clear sight of him (v43)

`docs/BRIEF-27-clear-sight.md`

- The gold strike arrow no longer hides the foe during openings. It's slimmer and slightly
  see-through, and its label ("Pendragon Cross 1/3") moved off his body to the side.

## No capes (v44)

- Removed every cape at your request: Gawain's lion cape, the foes' capes and the Green Knight's
  leafy cloak, in the game and in the animation lab.

## Brief 28, lessons from Infinity Blade (v45)

`docs/BRIEF-28-infinity-blade-lessons.md` (from `docs/INFINITY-BLADE-STUDY.md`)

- **Quieter words:** "Parry", "Perfect block" and the rest are now one small word under the health
  bars, one at a time, gone in under a second. Big centre text is kept for rare moments.
- **Parry burst:** a white starburst with blue-white spikes where the blades meet, then speed lines
  running out. No more gold wash over the whole screen.
- **Brighter blade trails** on your cuts.
- **Ghosted buttons** that brighten when he attacks or you press them.
- **The finish:** a white flash on the killing blow, and a fade to white into Victory.

## Brief 29, measured blows (v46)

`docs/BRIEF-29-measured-blows.md`

- **Cleaner swings:** each cut now plays out in full (coil, cut, follow-through), and the hit lands
  when the blade arrives, not at the swipe.
- **No reward for flailing:** extra swipes mid-cut are dropped and "rush" the next cut (60% damage),
  and a cut that rings off his guard throws you off balance for a moment, open to his blow.
- **Timing rewarded:** a **Timed cut** (the first cut the instant he opens) does 1.5× damage. In
  testing, measured cutting dealt about 50% more than frantic swiping.
- Damage was retuned, and a straight playthrough by the test bot matches the earlier difficulty
  curve.

## Brief 30, a clean swipe (v47)

`docs/BRIEF-30-clean-swipe.md`

- Studied your swing frame by frame. The blade wobbled up and behind your head before cutting, and
  the trail was a big pale sheet. Each swipe is now one clean arc: draw back, straight across the
  front at the foe, through to the far side.
- The trail is now a thin streak following the tip, shown only during the cut.

## Loading screen and no border (v48)

- The loading screen is now your photograph of the Sacra di San Michele above the clouds. In
  landscape, the title and progress bar sit in the fog beside the abbey; on an upright phone the
  abbey is at the top, fading into fog where the title sits.
- The illuminated border is gone from every screen.

## Brief 31, the sword wrist and footwork (v49)

`docs/BRIEF-31-wrist-and-footwork.md`

- **Wrist:** the arm now finds an elbow position that keeps the wrist natural, and the wrist bends
  only within a real wrist's range. No more cocked, folded sword hand (for Gawain and every foe).
- **No more gliding:** feet stay planted and step when the body moves (lunges, recoveries, dodges),
  for everyone.
- The foes' blade trail is now a thin streak too.

## The abbey on the menus, and plainsong (v50)

- The title screen and the Book of Arms now show the Sacra di San Michele above the clouds:
  between the panels in landscape, above Continue on an upright phone. The crest gave way to it.
- **Menu music:** "Wendale Abbey", a short plainsong chant by Yubatake (CC BY 4.0, OpenGameArt.org).
  It loops quietly on the menus, starts on your first tap and fades out as you ride into a duel.
  It respects the Music setting.
- **Credits:** a new section at the end of the Book of Arms lists the work by others in the game.

## Brief 32, weight (v51)

`docs/BRIEF-32-weight.md`

- **Your cut is weightier:** a real wind-up with a beat of stillness, then the drive through
  contact, a follow-through that carries on past, and a settle before guard. 0.42 s in all.
- **The foes' blows** carry past and settle more slowly after the impact, which stays on the beat.
- Damage was retuned for the slower, heavier cuts; a full bot playthrough keeps the difficulty curve.

## Real sounds (v52)

- **Real recordings** now carry the most important sounds:
  - Steel on steel (parries, blades turned, the blade lock): real weapon recordings (CC0).
  - Cuts landing on plate, mail or leather; shield blocks and a splintering shield; footsteps on
    stone; cloth on dodges; a sword drawn as each duel begins; a blade clattering to the floor
    on a disarm; the pages of the Book of Arms (Kenney, CC0).
- 34 trimmed clips, 175 KB in all, loaded in the background on your first tap. Each varies slightly
  in pitch and level so repeats don't sound identical.
- The voices, crowd, whooshes and duel music are still synthesised.
- I couldn't listen to them myself, so tell me which ones jar.

## Updates arrive reliably; the photo zoomed out (v53)

- **Fixed an update bug.** A new release could store the previous release's files: the offline
  cache fetched them through the browser's own 10-minute cache. So you could be shown an older
  swing after an update. New releases now always fetch fresh files.
- The abbey photo is zoomed out a little on the menus and the loading screen, set in its own fog
  with soft edges.

## Sounds louder, version shown (v54)

- **The version number** (v54) now shows in the corner of the title screen, so you can tell whether
  an update has reached your device.
- **The recordings are louder**, and the synthesised layers under them (the swipe's whoosh, the low
  thuds) are quieter, so the real steel, armour, shield and footsteps come through.
- The clips download as the page opens, so they're ready from the first blow.
- To release: bump both `VERSION` in service-worker.js and `BUILD` in src/config.js.

## Sound clips on older Safari (v55)

- The clips (and the menu chant) were decoded with a form of the browser's audio call that older
  Safari doesn't support. There the recordings failed silently and the old synthesised sounds played
  instead. They now use the form every browser supports.
- After your first tap, the title screen's corner shows how many sound clips loaded (for example
  "v55 · sounds 34/34"), and the reason if any failed.
