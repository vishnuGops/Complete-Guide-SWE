# Every Choice Of K

## Approach

A choice is a subset of a fixed size, and the only new ideas are where the
recursion starts and where it stops.

```
build(from, chosen):
    if chosen.length == k:
        record a copy
        return
    for value in from .. n:
        chosen.append(value)
        build(value + 1, chosen)      # never look back
        chosen.pop()
```

**`value + 1`, not `from + 1`.** Each level only considers numbers larger than
the one just taken, so each combination is generated exactly once, in ascending
order. Without that, `[1, 2]` and `[2, 1]` both appear and the answer is `k!`
times too long.

**The pruning is worth adding**, and is the reason this problem sits where it
does. If fewer numbers remain than are still needed, no completion exists and the
branch can be abandoned at once:

```
for value in from .. n - (k - chosen.length) + 1:
```

Without it the recursion walks branches that are provably dead — with `n = 14`
and `k = 13` that is most of them. The bound is exactly "leave enough behind to
finish", and deriving it is the useful exercise.

`k = 0` answers `[[]]` — one way to choose nothing, not zero ways — which falls
out of the base case testing the length rather than the numbers left.

## Complexity

- Time: `O(k · C(n, k))`, the size of the output.
- Space: `O(k)` besides the answer.

## Pitfalls

- **Restarting the loop from 1 at each level.** Every combination appears `k!`
  times, in every order.
- **`k = 0`.** One empty choice, not none.
- **Recording without copying**, and **forgetting the pop** — as always.
- **Building every subset and filtering by size.** Correct, and `2^n` work for
  `C(n, k)` answers.
