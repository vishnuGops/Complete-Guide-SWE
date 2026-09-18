# Where It Would Go

## Approach

This is the boundary form of binary search, and it is the only form worth
memorising, because every other version can be written in terms of it.

The row is sorted, so the predicate `readings[i] < target` is true for a prefix
of the positions and false for the rest. The answer is the first position where
it turns false. Searching for a *boundary* rather than for a value means there
is no "not found" case to handle: the boundary always exists, and it is `n` when
the predicate never turns false.

```
low, high = 0, n            # a half-open range [low, high)
while low < high:
    mid = low + (high - low) // 2
    if readings[mid] < target:
        low = mid + 1       # the boundary is strictly above mid
    else:
        high = mid          # mid might itself be the boundary
    # invariant: the answer is always inside [low, high]
return low
```

Three details carry the whole thing:

- **`high` starts at `n`**, not `n - 1`. The answer can be one past the end.
- **`high = mid`, not `mid - 1`.** When the predicate is false at `mid`, `mid` is
  still a candidate.
- **`low + (high - low) / 2`** instead of `(low + high) / 2` — in a language with
  fixed-width integers the sum can overflow, and the two forms are otherwise
  identical.

Since the range shrinks every iteration and never excludes the answer, the loop
terminates with `low == high` at the boundary.

## Complexity

- Time: `O(log n)`.
- Space: `O(1)`.

## Pitfalls

- **Searching for the value.** The classic three-way binary search has to invent
  an answer when the target is absent, which is exactly the case being asked
  about.
- **`high = mid - 1` with `high` inclusive.** It works, but it needs a separate
  variable to remember the best candidate seen, and it is where off-by-one bugs
  live.
- **Returning the last occurrence.** With duplicates the answer is the *first*
  position not below the target.
- **The empty row.** `n = 0` answers 0, and the loop body never runs.
