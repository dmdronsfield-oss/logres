# Brief 10: coherence pass

Nine briefs added a lot in a short time. Before adding more, make sure it all hangs together for a new
player on a phone.

## 1. Lessons that wait their turn
One-time lessons (riposte, gaps, bash, lock…) can currently arrive together or cover an incoming blow.
Queue them: show one at a time, only while he's recovering or waiting, never during his wind-up, and
at least a few seconds apart.

## 2. Portrait check of everything new
The lock bar, gap arrows, ring tags, edge flashes, entrance sweep, kill cam and your fall, all on an
upright phone. Fix any overlaps or bad framing.

## 3. Difficulty from a fresh start
All tests so far ran on a save with many levels. Re-test from level 1, generation 1, with an imperfect
bot. Tune foe health or timings so that:
- the Saxon and the Black Knight are winnable by a learner;
- the Red Knight and the Green Knight need the new skills.

## Done when
The queue works (bot-checked: no lesson during a wind-up); portrait screenshots are clean; the fresh-save
results are recorded below and tuned; release published.

## Results

- Lessons now queue: urgent ones (shield bash, hesitation, blade lock, riposte) show at once; the rest
  wait until he's open, roaring, or well before his next blow, at least 4.5 s apart.
- **Fresh-save test, before tuning:** an imperfect bot (skill 0.5) beat everything without dying; the
  Saxon fell after one of his own blows, because each opening lets you land 6 to 9 hits.
- **Tuning:** foe health raised (Saxon 90→180, Black 170→320, Brigand 200→380, Red 250→440, Green
  440→640); the Green Knight's blows hit about 20% harder. The test bot now swipes at a human rate
  (about 3.5 a second).
- **After tuning (fresh save, skill 0.4 to 0.6):** Saxon about 12 s and easy; Black Knight about 22 s,
  ending on half health; Brigand about 36 s, ending on a third; Red Knight about 26 s, and he killed
  the skill-0.6 bot once with 13 health left on him; Green Knight about 30 s.
- **Portrait:** entrance sweep, guard arrows and blade lock checked upright. The lock camera was too
  close on a narrow screen and was eased back; blade trails now switch off while blades are bound
  (they flared into a sheet).
