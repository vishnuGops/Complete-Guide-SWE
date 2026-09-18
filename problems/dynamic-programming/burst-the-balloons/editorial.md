# Best Order To Burst

## Approach

**Deciding what to burst first does not work**, and understanding why is the
whole problem. When a balloon is burst, the two sides of the row become adjacent,
so the left part and the right part are no longer independent — a later burst can
score across the gap. The subproblems overlap, and the recursion does not
decompose.

**Deciding what to burst last does work.** Fix a range and ask which balloon in
it is burst *last*. At that moment everything else in the range is gone, so its
two neighbours are exactly the balloons just outside the range — which are, by
construction, still intact. And everything to its left inside the range was burst
without ever touching anything to its right, and vice versa. The two sides are
genuinely independent.

Pad the row with a `1` at each end and write `best(left, right)` for the largest
score from bursting everything strictly between positions `left` and `right`:

```
best(left, right) = max over last in left+1 .. right-1 of
      best(left, last) + best(last, right)
    + padded[left] * padded[last] * padded[right]
```

with `best(left, right) = 0` when there is nothing between them. The answer is
`best(0, n + 1)`.

Filled by increasing gap — so both halves are known before the range that
contains them — this is `O(n³)` time and `O(n²)` space. At `n = 300` that is
about nine million updates.

**The padding is not cosmetic.** It turns "a missing neighbour counts as 1" into
an ordinary cell, so the recurrence has no boundary cases at all.

**Why the ranges are open.** `best(left, right)` deliberately excludes its
endpoints, because those are the balloons that must still be standing when the
last one inside goes. Writing the range closed and trying to remember which
neighbours survive is where this problem usually goes wrong.

## Complexity

- Time: `O(n³)`.
- Space: `O(n²)`.

## Pitfalls

- **Recursing on "which to burst first".** The subproblems are not independent.
- **Closed ranges.** The endpoints must be the surviving neighbours.
- **Forgetting the padding**, and then special-casing both ends by hand.
- **Filling the table in index order rather than by increasing gap.** The halves
  must be finished before the whole.
