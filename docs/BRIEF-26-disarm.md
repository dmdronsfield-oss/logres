# Brief 26: the disarm

Parrying is the hardest answer and should have the biggest reward. Three parries in a row, with
nothing else between them, strike the weapon from his hand.

## Work
- **Rule:** the third parry in a row disarms him (a dodge, block or hit in between resets the count).
  He is open for about 2.6 seconds and can't attack or slip away. Then he stoops, takes up his weapon,
  and the fight goes on.
- **In the hall:** his weapon spins up out of his hand, falls point-first and sticks in the floor
  beside him with a clatter. He staggers back empty-handed, then reaches down for it, and it's back
  in his hand.
- **Feedback:** "Disarmed!" callout, a cheer from the galleries, a lesson the first time, and a Book
  of Arms entry ("The Disarm").

## Done when
Disarm triggers on the third parry in a row and not otherwise; the weapon flies, sticks and returns
cleanly for every foe's weapon (sword, falchion, axe); the bot passes; release published.

## Results

- Rule test: parry, parry, dodge, parry, parry, parry. The count read 1, 2, then reset to 0 by the
  dodge, then 1, 2, and the third parry disarmed him. When a parry fills his stagger meter he is
  staggered instead, and the count carries on.
- In the hall: the weapon spins up out of his hand (about two turns, 0.85 s), falls point-first and
  sticks in the floor to his left, on the open side of the screen, where Gawain doesn't hide it.
  Checked with the Black Knight's sword, the Brigand's falchion and the Green Knight's axe. He
  reaches across for it, and it's back in his grip about 0.4 s before he's on guard again. Afterwards
  the weapon is reattached with its original transform.
- The test bot parries rarely (about one per duel), so it never disarmed anyone in 5 duels. It still
  won all 5, with no console errors. A disarm is a reward for a player who can parry well.
