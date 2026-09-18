# Repeat Within Reach

## Approach

For each reading, the only sighting worth remembering is the most recent one. If
an older sighting of the same value is within `k` positions, then the newer one —
which is closer — is too, so the older one can never be the deciding pair. That
single observation turns "every pair within reach" into "one position per
distinct value".

So walk the log once with a map from value to the position it was last seen at.
At each position, if the value is in the map and the gap is at most `k`, the
answer is yes; otherwise record the current position and move on.

The sliding-window phrasing is the same algorithm wearing different clothes:
keep a set of the values in the last `k` positions, test membership, then add
the current value and evict the one that has fallen out of reach. That version
uses `O(k)` space instead of `O(n)`, which is the better trade when `k` is small
and the log is long.

## Complexity

- Time: `O(n)` — one map operation per reading.
- Space: `O(min(n, k))` with the window, `O(n)` with the map of last positions.

## Pitfalls

- **Comparing every pair within reach.** `O(n·k)`, which at the stated maxima is
  a hundred million comparisons and does not finish.
- **`k = 0`.** Two *distinct* positions cannot be zero apart, so the answer is
  always `false`. A window implementation that adds the current value before
  testing it will report `true`.
- **Recording the position before testing it.** The current position is not a
  repeat of itself; test first, then overwrite.
- **Evicting the wrong element.** When the window slides past position `i`, the
  value to remove is `readings[i]`, not the value just added.
