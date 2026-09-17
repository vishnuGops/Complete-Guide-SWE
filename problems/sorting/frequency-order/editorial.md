## Approach

The problem is two steps that are easy to conflate. First count: a map from value
to how many times it occurs. Second order: sort the _distinct_ values, not the
log, using a comparison built from the counts.

The tie rule is what makes the answer unique, and it has to be part of the
comparison rather than left to whatever order the map happens to produce. A sort
that only compares counts gives a different answer on different runtimes, which
is the kind of bug that passes locally and fails in review.

## Complexity

With `d` distinct values:

- Time: `O(n + d log d)`.
- Space: `O(d)`.

## Pitfalls

- Sorting the original list instead of the distinct values leaves duplicates in
  the result.
- Comparing counts but not breaking ties leaves the order up to the map, which is
  unspecified in both languages.
- In Java, `Integer.compare(b, a)` is the descending comparison; subtracting
  counts is fine here but the habit overflows on large values.
