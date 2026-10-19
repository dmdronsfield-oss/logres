# Brief 29: measured blows

Your feedback: "sword swings need to be cleaner and the gameplay needs to reward patience and timing,
not just furious swiping."

## Why it's like that now
- After a swipe the sword arm is free again after 90 ms, but the swing animation takes 360 ms and
  only reaches him at 150 ms. Fast swiping restarts the cut before the blade ever arrives: a blur of
  half-swings, with damage landing before the blade does.
- Up to about eight cuts a second count during an opening, so the fastest swiper wins.
- Cutting at his guard costs almost nothing. Only a second clang within 1.2 s brings an answer.

## Work
1. **One clean cut at a time:**
   - Each swing plays in full (coil, cut, follow-through, 0.25 s).
   - A swipe made late in a swing is kept and follows on at once; earlier extra swipes are dropped.
2. **Damage when the blade arrives:** the hit, sparks, number and sound land at the moment of contact
   (85 ms into the swing), not at the swipe. If he has recovered by then, it rings off his guard.
3. **Flailing costs you:** a cut that rings off his guard throws you off balance for about 0.3 s. You
   can't dodge, block or cut, so cutting at him while he winds up usually means taking the blow. It's
   taught once and in the Book of Arms. (Not during the tutorial's first lessons.)
4. **Timing is rewarded:** the first cut into an opening that lands within 0.4 s of him opening is a
   **Timed cut**, for 1.5× damage. Being ready, not mid-swing or off balance, pays.
5. **Retune:** with fewer, cleaner cuts, check duel lengths with the bot and adjust damage so the
   difficulty curve from brief 21 holds.

## Done when
Swings read cleanly in stills; spam swiping does no more damage than measured cutting; the bot's
results match brief 21's curve; release published.

## Results

**Swing:**
- 0.25 s: coil at 40 ms, the blade reaches him at 85 ms (when the hit lands), follow-through at
  150 ms, back on guard at 250 ms.
- The animation now runs on the swing's own timer, so the blade and the hit always coincide.
- A swipe made in the last 140 ms of a cut follows on at once. Earlier swipes are dropped and
  **rush** the next cut, which bites for 60%.

**Spam against measured cutting**, in one 2 s opening against the Black Knight:

| Swiping | Cuts landed | Damage |
|---|---|---|
| Every frame (frantic) | 7 | 70 (most cuts rushed) |
| Every 4 frames | 7 | 70 |
| Every 0.3 s (measured) | 6 | 81 |
| Every 0.33 s (measured) | 6 | 104 (Timed cut first) |

Measured cutting deals about 50% more than frantic swiping.

**New rules:**
- **Off balance** after a cut rings off his guard: 0.32 s. Most cases in testing were mistimed
  parry attempts during his wind-up. Swiping before the parry window now costs you.
- **Timed cut:** the first cut landing within 0.4 s of him opening, for 1.5× damage.

**Retune:**
- Your base damage goes from 10 to 14, to make up for fewer cuts.
- Brigand health 380 → 340, Green Knight 720 → 640.
- The test bot now cuts in a measured rhythm: it swipes once its cut is nearly done.

**Campaign check** (brief 21's method): a fresh save played straight through with real levelling,
30 duels at bot skill 0.6.

| Foe | Wins |
|---|---|
| Saxon | 6/6 |
| Black Knight | 6/6 |
| Brigand | 6/6 |
| Red Knight | 6/6 |
| Green Knight | 3/6 |

That's the same shape as brief 21: every foe beaten but the Green Knight, the finale, who wins half
the time. No console errors.

Book of Arms entries added: The Timed Cut, The Clean Cut, Off Balance.
