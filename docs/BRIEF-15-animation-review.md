# Brief 15: animation review

The knights now wear a different, bulkier body than the one the motion was written for. Review every
move frame by frame in the lab (updated to match the game exactly) and fix what doesn't read.

## Lab brought up to date
The lab now shows the plate knights in INKXO's harness, uses each weapon's swing style and the release
timing, and has the new moves: shield bash, challenges, high and low guard, taking a cut, blade lock,
and the Pendragon.

## Found in review
1. **Overhead blows (↓):** at the moment of the cut the blade points straight at Gawain, so from the
   game camera it shrinks to a dot exactly when you need to see it. Meanwhile his shield flies up over
   his head.
2. **Follow-throughs of level and downward cuts** carried the weapon round and up (the Green Knight's
   sweep ended with the axe upright), muddying where the blow went.
3. Gawain's horizontal cuts and the Green Knight's sweep otherwise read well.

## Fixes
1. The overhead cuts down and across to his left, so the blade stays a visible slash; the shield stays
   forward and low.
2. Follow-throughs never rise above the cut for level or downward blows.
3. The lab's dodge matches the game's.

## The big find: a joint-solver bug
Measuring the Black Knight's shield hand during his overhead showed it 0.8 m from where it was aimed:
the elbow bent the wrong way. The two-bone solver (arms and legs) built its bend axis from the "pole"
direction; when the upper arm swings past the pole (a far, low target) that axis flips and the
forearm folds backwards. The bend axis now comes from the chain's own plane, and the hand lands
exactly on target. This affected any pose with a low, far-reaching hand (shields flying up over heads
in strikes and recoveries). It's probably part of what looked wrong with the arms early on.
