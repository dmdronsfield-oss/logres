# Brief 16: pose audit

Brief 15's arm bug was only found by measuring. Measure everything.

## The audit
A lab tool that plays every move of every figure, samples every 40 ms, and records:
- **Reach errors:** how far each hand and foot ends from where the pose aims it.
- **Floor:** feet below the floor; knees through it.
- **Self-collision:** a hand or the shield inside the torso; the blade passing through his own head.
- **Wrist:** how often the wrist limit is hit (the blade can't point where the pose wants).
It prints the worst cases by move and time, so they can be looked at and fixed.

## Then
Fix the worst cases, re-run until the report is clean or the remaining cases are intended, and record
the before and after numbers here.

## Results

`__lab.audit()` in the lab console runs the whole audit (122 moves, about 4 seconds).

| | Issues | Worst miss |
|---|---|---|
| First run | 41 (26 sword hand, 12 shield hand, 3 blade through head) | 0.73 m (Green Knight's ↘ follow-through) |
| After fixes | 11, all arms at full stretch | 0.15 m |

Fixes:
- **Follow-throughs** extrapolated the hand along its arc with no limit, aiming it up to 73 cm beyond
  arm's length (worst for the heavy axes). Hands are now clamped to a real arm's reach.
- **The shield arm turns with the trunk:** in big twisting sweeps the shield's aim stayed fixed while
  the shoulder swung away. It's now carried round with the body.
- Lying-down poses (defeat, death) are excluded; limbs sprawl where they fall and are judged by eye.
- The Brigand's pointing challenge reached too far and was shortened.
