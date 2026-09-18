# Highest So Far

## Approach

The answer at minute `i` is the largest of `readings[0..i]`, and that set differs
from `readings[0..i-1]` by exactly one element. So the answer at `i` is the
larger of two things already to hand: the answer at `i - 1`, and `readings[i]`.

That turns the whole problem into one pass with a single variable. Start the
variable at the first reading, and at each step take the larger of it and the
current reading, then record it.

The list of answers is the only thing that grows; nothing is ever revisited.

## Complexity

- Time: `O(n)` — one comparison and one append per reading.
- Space: `O(n)` for the answer, and `O(1)` beyond it.

## Pitfalls

- **Recomputing the maximum of a prefix at every step.** `max(readings[:i + 1])`
  inside the loop reads like the definition and is `O(n^2)`; at `n = 10^5` it is
  five billion comparisons.
- **Seeding the running value with zero.** Every reading may be negative, in
  which case the answer would be a list of zeroes. Seed it with the first
  reading, or with negative infinity.
- **Appending before updating.** The answer at a minute includes that minute's
  own reading.
