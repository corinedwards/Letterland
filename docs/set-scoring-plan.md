# Set Scoring — Planning Doc

Reward players for getting matching letter styles across all five slots (C O R I N).

## Config changes

Add a `"set"` property to each style group in `shapes-config.json`:

```json
"C-ComputerSpace, C-CyberLip, O-Dreamcast, R-YagiSega, I-CaliforniaGames, N-Pong": {
  "set": "retrogame",
  "color": "#FFDF00",
  ...
}
```

Shapes without a `set` are neutral — they don't count toward any hand and don't break one either. Only complete/partial hands of *named* sets are scored.

## Scoring logic

After any shape change, collect the set value for each of the 5 letter slots (or `null` for no-set shapes). Filter out nulls, then count occurrences per set name.

**Hands (highest to lowest):**

| Hand | Pattern | Example |
|---|---|---|
| Complete Set | 5 same | retrogame ×5 |
| Four of a Kind | 4 same | retrogame ×4, ooze ×1 |
| Full House | 3+2 | retrogame ×3, chunky ×2 |
| Three of a Kind | 3 same | retrogame ×3 |
| Two Pair | 2+2 | retrogame ×2, ooze ×2 |
| One Pair | 2 same | retrogame ×2 |

Incomplete sets (where a set doesn't have a shape for every letter, e.g. Raver has no O) are excluded from scoring — a Complete Set requires all 5 slots to match.

## Score tracking

- `totalPoints` counter increments each time a named hand is achieved
- Don't re-award the same hand if the player keeps clicking the same letter — only trigger on *change* to a new hand or improvement
- Session-only (no persistence needed for now)

## UI

- Small toast/overlay when a hand is detected: e.g. **"Full House! +1"**
- Points tally displayed somewhere subtle near the controls
- Celebrate Complete Set more dramatically than lower hands

## Implementation order

1. Add `"set"` tags to `shapes-config.json`
2. Track current set per letter slot in scene state
3. Write `evaluateHand(sets[])` scoring function
4. Hook into the shape-change event to call evaluator
5. Build toast UI component
