# First And Last Sighting

## Approach

Both answers are boundaries of the same kind, so one routine answers both.

Define `boundary(p)` as the first index where the predicate `p` is false — the
same half-open search as `insert-position`. Then:

- `lo = ` first index where `readings[i] >= target`, i.e. the boundary of
  `readings[i] < target`.
- `hi = ` first index where `readings[i] > target`, i.e. the boundary of
  `readings[i] <= target`.

The run of targets is exactly `[lo, hi)`. That gives everything at once:

- If `lo == hi`, the run is empty and the target is absent — return `[-1, -1]`.
  This covers `lo == n` too, so there is no separate bounds check.
- Otherwise the answer is `[lo, hi - 1]`.

Two searches, `O(log n)` each. The pattern generalises: "how many copies of the
target are there" is `hi - lo`, and "what is the first reading above the target"
is `readings[hi]`, both for free.

## Complexity

- Time: `O(log n)`.
- Space: `O(1)`.

## Pitfalls

- **Finding one occurrence and walking out.** Correct but `O(n)`, and `[2,2,...,2]`
  with the target 2 is the worst case the constraints explicitly allow.
- **Comparing `readings[lo] == target` without checking `lo < n`.** The first
  boundary can land one past the end; reading there is out of bounds. Comparing
  the two boundaries avoids the question entirely.
- **Reusing `<` for both searches.** The only difference between the two is `<`
  versus `<=`, and getting it wrong returns the same index twice.
- **Off by one on the upper end.** The run is half-open: the last sighting is
  `hi - 1`.
