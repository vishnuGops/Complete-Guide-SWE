# Ways To Reach The Total

## Approach

Choose values one at a time, subtracting each from what is left:

```
build(start, remaining):
    if remaining == 0:
        record a copy
        return
    for i in start .. n-1:
        if values[i] > remaining: break        # sorted, so nothing later fits
        chosen.append(values[i])
        build(i, remaining - values[i])        # i, not i + 1
        chosen.pop()
```

Two decisions are doing the work.

**`build(i, …)`, not `build(i + 1, …)`.** Staying at `i` is what allows a value
to be used again; moving forward is what stops `[2, 3]` and `[3, 2]` both being
produced. Each combination comes out exactly once, in non-decreasing order.

**Sorting, then `break` rather than `continue`.** Once a value exceeds the
remainder, every later value does too, so the whole rest of the loop is dead.
That single line is the difference between exploring the useful branches and
exploring all of them — and at `target = 40` with twenty values it is most of
the running time.

There is no separate "remaining < 0" case: the `break` means it never happens.

**Against `coin-ways`.** That problem asks *how many* combinations there are and
answers it with dynamic programming in `O(values · target)`. This one asks for
the combinations themselves, and there can be exponentially many, so no clever
table helps — enumerating them is the job. Knowing which of the two a question is
asking decides the whole approach.

## Complexity

- Time: proportional to the number of answers times their length.
- Space: `O(target)` for the recursion, which is as deep as the smallest value
  divides the target.

## Pitfalls

- **`i + 1` instead of `i`.** Each value can then be used only once, which is a
  different problem.
- **Starting the loop from 0 at every level.** Every combination appears once per
  ordering.
- **`continue` instead of `break`.** Correct and much slower.
- **Recording without copying**, and **forgetting the pop**.
