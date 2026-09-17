## Approach

Sorting solves this in `O(n log n)`, and for a target of `O(n)` the sort has to
go. What replaces it is a set and one idea: walk each run only from its start.

Put every value in a set. A value `v` starts a run exactly when `v - 1` is not
present. From such a `v`, walk upwards while the next value is present and record
how far you got.

The inner walk looks like it could make this quadratic, but it cannot: a value is
only ever walked as part of the single run that contains it, and only the run's
starting value triggers a walk. Across the whole input the inner loop takes as
many steps as there are distinct values.

Duplicates disappear into the set, which is exactly the required behaviour.

## Complexity

- Time: `O(n)` amortised.
- Space: `O(n)`.

## Pitfalls

- Walking upwards from every value, not just run starts, turns a linear scan into
  a quadratic one on input like `1, 2, 3, ..., n`.
- Counting the list rather than the set counts duplicates as run members.
- An empty input must answer `0`; a loop that assumes at least one value reports
  `1`.
