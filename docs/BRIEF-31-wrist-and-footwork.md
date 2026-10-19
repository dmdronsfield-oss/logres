# Brief 31: the sword wrist and footwork

Your notes: "our sword hand wrist looks awkward angle"; "watch the foot work - our characters tend
to glide"; "enemies glide also."

## The wrist
- **Measured:** the angle between forearm and blade, split into the two wrist movements: tilt in the
  arm's plane (ulnar/radial) and sideways (flexion/extension).
- **Before:** the wrist was jammed at its 77° limit in the guard and in almost every frame of every
  cut. The arm solver pointed the forearm along the blade (hand up at the chest, elbow below), so the
  hand had to fold sideways to aim the sword. Close up: forearm down, blade steeply up, pommel
  hanging below the gauntlet.
- **Fix, in the shared animator (Gawain and every foe):**
  1. Each frame, try the elbow at 24 points round the circle it can sit on. Score each for a natural
     wrist (tilt 0 to 40°, little sideways bend), an elbow kept low and outside the body, and
     steadiness from frame to frame. Use the best.
  2. Then bend the wrist only within a real wrist's range: −15° to +45° tilt and ±50° sideways.
- **After:** the guard reads as a hammer grip, forearm forward and blade rising straight from the
  fist. Cost: 0.07 ms per figure per frame.

## Footwork
- **Before:** the feet were placed relative to the body every frame. Whenever the body moved (lunges,
  steps back, dodges, settling into guard), both feet slid across the floor with it.
- **Fix:** foot planting. Each foot stays where it was put on the floor. When the pose wants it more
  than 10 cm away, it takes a quick lifted step (0.14 s, 8 cm arc), one foot at a time unless the
  body moves hard (more than 32 cm). A jump of more than 70 cm, such as a camera cut, just snaps.
- **Measured:**
  - A foe's lunge-and-recover (1.6 m of body travel): the feet move only in steps.
  - Gawain's dodge (0.8 m sideways and back): a quick two-footed hop out and back, with no sliding
    frames.

Also: the foes' blade trail is now the same thin tip streak as yours (it was still the old pale fan).

The bot still behaves as expected (the Saxon beaten, the Green Knight winning about half the time),
with no console errors.
