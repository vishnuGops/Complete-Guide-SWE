# The K Most Common

## Approach

Two steps, and the second is the one worth thinking about.

**Count.** One pass builds a map from value to how often it occurs. Nothing after
this point looks at the readings again — everything is about the `m` distinct
values, which is usually far fewer.

**Take the top `k` of the counts.** Three answers, all reasonable:

- **Sort the entries** by the ordering rule and take the first `k`.
  `O(m log m)`, three lines, and the right first answer.
- **A min-heap of size `k`** over the entries, keyed by the ordering rule
  reversed. `O(m log k)`, and the version this topic exists to teach — the same
  shape as `kth-largest-value`, with a comparator instead of a bare integer.
- **Buckets.** A value cannot occur more than `n` times, so an array of `n + 1`
  buckets indexed by count holds every entry, and walking it from the top gives
  the answer in `O(n)`. The prettiest of the three, and the one that stops
  working the moment the ordering rule involves anything but the count.

**The tie rule is not decoration.** Without it the answer depends on the map's
iteration order, which differs between Python and Java, between runs, and
between library versions. A problem whose answer is "whatever the hash table
felt like" has no single expected output — so the rule is stated, and both
references implement it.

## Complexity

- Time: `O(n + m log k)`.
- Space: `O(m)`.

## Pitfalls

- **Ignoring the tie rule.** The commonest cause of an answer that passes locally
  and fails elsewhere.
- **Heaping the readings rather than the entries.** That is `O(n log k)` with `n`
  far larger than `m`, and it counts duplicates as separate candidates.
- **Sorting by count alone.** Most sorts are stable, so equal counts come out in
  insertion order — which is the map's order, which is not defined.
