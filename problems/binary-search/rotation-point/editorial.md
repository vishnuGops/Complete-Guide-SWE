# Where The Series Turns

## Approach

A rotated ascending series is two ascending runs laid end to end, and everything
in the first run is larger than everything in the second. The smallest reading is
the first element of the second run, so the question at each step is only: _is
`mid` in the first run or the second?_

Comparing `readings[mid]` against `readings[high]` — the last reading still in
the range — answers it:

- `readings[mid] > readings[high]`: `mid` is in the first run (nothing in the
  second run exceeds the last reading, which is itself in the second run). The
  turn is strictly after `mid`, so `low = mid + 1`.
- `readings[mid] < readings[high]`: `mid` is in the second run, and it may be the
  smallest reading itself, so `high = mid`.

Equality cannot happen, because the readings are distinct and `mid < high`.

The invariant is _the turning point is always inside `[low, high]`_, and the loop
ends with `low == high`.

Comparing against `readings[low]` instead is the classic mistake. On an
unrotated series `readings[mid] > readings[low]` is true, which pushes the search
right and away from the answer at position 0. The unrotated case then needs a
special check up front; comparing against the right-hand end needs none.

## Complexity

- Time: `O(log n)`.
- Space: `O(1)`.

## Pitfalls

- **Comparing with the left end.** It needs a separate "already sorted" check,
  and forgetting it is a wrong answer on the most ordinary input there is.
- **`high = mid - 1`.** `mid` can be the turning point.
- **Assuming a rotation happened.** Zero is a legal rotation amount.
- **Duplicates.** With equal readings the comparison stops deciding anything and
  the worst case degrades to `O(n)`; the statement rules them out for that
  reason.
