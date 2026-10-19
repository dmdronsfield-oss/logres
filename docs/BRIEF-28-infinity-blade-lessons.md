# Brief 28: lessons from Infinity Blade

From `docs/INFINITY-BLADE-STUDY.md`. Infinity Blade's lesson is restraint: little on screen, big
moments at the point of contact. Logres keeps its telegraph markers (new players rely on them) and
takes the rest.

## Work and results
1. **Quieter callouts:**
   - The everyday words now use a new one-word callout, in small capitals at the top centre under
     the health bars: "Parry", "Riposte", "Perfect block", "Perfect dodge", "Counter", "Guard
     broken", "Shield spent", "Too soon", "He reads your…", "He gloats! Strike!", "He slips
     away"/"He turns your blade".
   - Pale gold is for yours, red for his, amber for warnings.
   - Only one shows at a time (a newer one replaces it), for about 0.9 s. It's timed on real time,
     so hit-stop and slow motion can't hold it back.
   - The big centre text is kept for rare moments: blade lock, Pendragon, disarm, stagger, known
     strikes, victory, defeat.
2. **Parry burst:** the full-screen gold wash and gold star are replaced by an effect at the point
   where the blades meet. First, a white core with seven blue-white spikes (about 0.3 s). Then
   fourteen thin speed lines running outward. Blade locks use a larger version. In comfort mode it
   is dimmer and has no speed lines.
3. **Your blade trails:** brighter, as a ribbon on the outer half of the blade running a quarter
   past the tip. They're bright at the leading edge and fade quickly behind, and last a little
   longer (170 ms, 210 ms for Excalibur). The colours are brighter: blue-white for most swords, warm
   gold for Clarent, ice-white for Excalibur. Trails now run on game time, so they linger properly
   in slow motion.
4. **Ghosted HUD:** the dodge, shield and super roundels rest at about half opacity. They brighten
   while he attacks, when pressed, when a lesson points at them, and (the super) when it's ready.
5. **The finish:** the killing blow lands in a white flash instead of gold, and the duel fades to
   white into Victory, which fades in from white.

Not done: the optional "Read his blade" setting (fading out the rings for experienced players).
Kept for later if wanted.

## Checked
- Parry burst and speed lines, the callout in landscape and portrait, ghosted roundels.
- Victory's fade from white.
- The bot beat the Black Knight, Brigand, Red Knight and Green Knight, with no console errors.
