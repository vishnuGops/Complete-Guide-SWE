# Every Balanced Fragment

## Approach

The point of this problem is the difference between **generate-then-filter** and
**generate-only-what-is-valid**.

The filtering version writes all `2^(2n)` arrangements of brackets and keeps the
valid ones. For `n = 8` that is 65,536 candidates for at most 1,430 answers — a
factor of 45 of pure waste before the depth limit is even considered, and it
grows.

The better version never writes an invalid prefix at all. Two counters are
enough, and each guards one branch:

```
build(opened, closed):
    if opened == n and closed == n:
        record the string
        return
    if opened < n and opened - closed < depth:
        write "(" ; build(opened + 1, closed) ; undo
    if closed < opened:
        write ")" ; build(opened, closed + 1) ; undo
```

- **`opened < n`** — there are opening brackets left to spend.
- **`opened - closed < depth`** — fewer than `depth` are currently open. This is
  the depth condition, and `opened - closed` is exactly the running count from
  `bracket-balance`.
- **`closed < opened`** — there is something open to close. This is what makes
  the string balanced, and it is the same running count again, read the other
  way.

Every leaf of this recursion is a complete valid string, so there is nothing to
validate and nothing thrown away.

With `depth = n` the second condition never bites and the count is the `n`-th
Catalan number — 1, 1, 2, 5, 14, 42, 132, 429, 1430 — which is why `n` is capped
at 8. With `depth = 1` exactly one string survives, and the recursion visits
almost nothing on the way: the pruning is doing real work rather than
bookkeeping.

`n = 0` gives one string, the empty one: the base case is reached immediately.

## Complexity

- Time: proportional to the number of answers times their length; no branch is
  ever explored and then discarded.
- Space: `O(n)` besides the answer.

## Pitfalls

- **Generating and filtering.** Correct and wasteful, and the waste is the
  lesson.
- **Allowing a closing bracket when none is open.** `closed < opened`, not
  `closed < n`.
- **Checking the depth after the fact.** It is checkable at every step, which is
  what makes it a prune rather than a filter.
- **Returning `[]` for `n = 0`.** One empty string.
