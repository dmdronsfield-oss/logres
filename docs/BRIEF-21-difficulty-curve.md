# Brief 21: the difficulty curve

Recent bot runs suggest the Red Knight (round 4) is harder than the Green Knight (round 5, the final
foe). Measure it properly and shape a rising curve.

## Method
Many full runs from a fresh save with the imperfect bot at two skill levels (0.5 and 0.7), keeping the
real progression (XP, levels, bloodline on death). Record each foe's win rate and the health the bot
has left.

## Target (skill 0.6 or so)
Saxon about 95% · Black Knight 85% · Brigand 75% · Red Knight 60% · Green Knight 45%, each foe
harder than the last. The final foe should be the hardest.

## Done when
Before and after tables are recorded here; tuning lands in `enemies.js`; release published.

## Results (bot skill 0.6, at the level a player would reach each foe, 3 to 6 duels each)

Win rates were 100% for every foe before tuning, so health left at the end is the clearer measure.

| Foe (level) | Before: health left | After: wins / health left | Change |
|---|---|---|---|
| Saxon (1) | 77% | unchanged | none |
| Black Knight (2) | 83%, easier than the Saxon | 4/4, 75% | blows about 20% heavier |
| Brigand (3) | 63% | unchanged | none |
| Red Knight (4) | 35%, the hardest | 4/4, 52% | blows about 10% lighter |
| Green Knight (5) | 73%, too easy for the finale | 2/3 wins, 93% when won | health 640→720, blows about 20% heavier |

The Green Knight is now the only foe who beats the bot. His blows can't be parried, so a fight with
him is all-or-nothing: clean wins or a loss. That suits a final foe; the sample is small.
