# Brief 25: he reads you

A good duellist notices habits. Today a player can win by answering every blow the same way (always
dodging left, always raising the shield). Foes from the Black Knight on should notice, and say so,
so the player learns to vary their answers.

## Work
- **Track the player's answers** in each duel: dodge left, dodge right, block, parry.
- **When one answer dominates** (4 of the last 5), the foe's next attack answers it, using only his
  own moves:
  - always dodging one way: a blow that can't be dodged that way (a cut from the other side, a thrust);
  - always blocking: a heavy or unparryable blow, a bash, or a long combination to drain the pips;
  - always parrying: a feint (he checks his swing, then strikes).
- **Make it fair and readable:** as he starts that attack, a callout says what he has read ("He reads
  your dodge!"). The first time, a lesson explains it. No more than once every three attacks.
- The Saxon (round 1) doesn't read you. New Book of Arms entry: "He Reads You".

## Done when
The read triggers in tests for each habit and picks a fitting attack; the callout and lesson show; the
bot (which favours dodging) still wins at about its old rate; release published.

## Results

Test with each habit forced (the Red Knight, four attacks each):

| Habit | What he chose |
|---|---|
| Always dodging left | slashW + slashE (the first cut can only be dodged right) |
| Always dodging right | thrusts and east-side cuts (no dodge, or left only) |
| Always blocking | his reaping blow (heavy) every time |
| Always parrying | a feint on the first blow, every time |

The callout ("He reads your shield!") shows as he begins the attack, with a jeer from the galleries,
and a lesson the first time.

Bot (skill 0.7, varied answers): 6 of 6 wins against the Black Knight, Brigand and Red Knight, at
50–87% health. It was read once in six duels, so a player who mixes their answers is seldom read.
