# Ways Up The Stairs

## Approach

Ask about the **last** move. To be standing on step `n`, the move before must
have come from step `n - 1` or from step `n - 2`, and those are different ways
of arriving. So

```
ways(n) = ways(n - 1) + ways(n - 2)
ways(0) = 1        # one way to climb nothing: make no moves
ways(1) = 1
```

which is the Fibonacci sequence, shifted.

**Why the direct recursion is wrong in practice.** Computed downwards it
recomputes `ways(n - 2)` from both branches, and `ways(n - 3)` from three, and so
on — `O(2^n)` calls for `n + 1` distinct answers. At `n = 45` that is tens of
billions of calls to produce 46 numbers.

Two fixes, and they are the two halves of this topic:

- **Memoisation** — keep the answers you have computed and return them instead of
  recomputing. The recursion is unchanged; it just stops repeating itself.
- **Tabulation** — compute the answers upwards from the base cases, so each is
  available before it is needed. No recursion, no stack.

And then the observation that makes it `O(1)` space: the recurrence only ever
looks two back, so the whole table is never needed. Two variables, rolled
forward, is the finished answer.

**`ways(0) = 1`** is the base case that trips people. It is not zero: there is
exactly one way to do nothing, and setting it to zero makes every answer zero.

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- **The plain recursion.** Exponential for no reason.
- **`ways(0) = 0`.** Everything collapses.
- **Overflow.** `ways(45)` is 1,836,311,903, which fits in a signed 32-bit
  integer with about 15% to spare — and `ways(46)` does not. That is why the
  bound is 45.
- **Treating `1+2` and `2+1` as the same.** They are different ways here.
