# Brief 30: a clean swipe

Your feedback: "the sword swipes are not clean, look at them frame by frame. Needs to be a clean
swipe." Studied frame by frame from the game camera with a new harness tool,
`swingSheet(dir, cells, cols, { open: true })` in `tools/harness.js`. It makes one cell per frame of
the swing and skips hit-stop repeats.

## What the frames showed (rightward swipe)
- **No single arc.** The blade rose (17–33 ms), tipped back behind his head (50 ms), came upright
  again (67 ms), then dropped out to the right (83 ms). The wind-up and strike marks point the blade
  in nearly opposite directions, and the blend between them took the short way round, over the top
  and behind the head.
- **Smeared motion.** The body springs (stiffness 30) couldn't keep up with a 0.25 s swing, so the
  wind-up was reached late and the cut smeared.
- **The trail was a sheet, not a streak.** It covered the whole area the blade swept, from the
  wind-up on, stayed frozen over the foe through the hit-stop, and hid the sword itself.
- **The overhead cut began out of sight.** Its wind-up pointed the blade back at the camera, behind
  his head.

## Fixes
1. **One clean arc:**
   - The swing now runs: draw back to the wind-up (55 ms), then **straight across the front at the
     foe** (85 ms, the moment of contact), on to the far side (120 ms), follow-through (165 ms) and
     back on guard (250 ms).
   - The new "through" key fixes the route, so the blade can't swing round behind the head.
2. **Tight tracking:** body springs at 70 during the swing, so the swing's own timing shapes the cut.
3. **Visible wind-up:** your wind-up blade never points back toward the camera; it's raised or held
   out to the side.
4. **A streak along the tip:**
   - The trail is a thin ribbon around the tip of the blade (86% to 108% of its length), following
     the tip's path.
   - It's drawn only during the cut itself (50–140 ms), never the wind-up or the return, and fades
     within about 0.1 s.

Checked frame by frame from the game camera: rightward (E), overhead (S), leftward (W) and rising
diagonal (NE). Each is now one readable arc with a crisp streak. The bot still wins, with no console
errors.
