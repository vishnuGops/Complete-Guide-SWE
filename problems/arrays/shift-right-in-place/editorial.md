## Approach

Two observations turn this into a few lines.

First, a shift of `n` is a shift of nothing, so only `shift % n` can matter.
Reducing first is what keeps `shift = 10^9` from being a different problem to
`shift = 4`.

Second, the triple reversal. Reverse the entire row: the block that should end up
at the front is now at the front, and the block that should follow it is now
behind — but both blocks are internally backwards. Reversing each block in turn
puts them right.

```
values = [1, 2, 3, 4, 5], shift = 2

reverse all          [5, 4, 3, 2, 1]
reverse [0, 2)       [4, 5, 3, 2, 1]
reverse [2, 5)       [4, 5, 1, 2, 3]
```

Each reversal is a two-pointer swap loop, so the whole thing is one pass worth of
work with nothing allocated.

The cyclic-replacement method (follow the cycle `i -> (i + shift) % n`, carrying
one value, and restart from the next unvisited index after `gcd(n, shift)` cycles)
reaches the same bounds and is a fine answer. It is harder to get right and much
harder to explain in an interview, which is why the reversal is the one to reach
for.

## Complexity

- Time: `O(n)` — each element is touched by exactly two of the three reversals.
- Space: `O(1)` — one temporary during each swap.

## Pitfalls

- **Forgetting `shift %= n`.** With `shift = 10^9` the reversal bounds go out of
  range and a naive rotate-one-step loop runs for a billion iterations.
- **Reassigning the parameter.** `values = values[shift:] + values[:shift]` in
  Python, or `values = newArray` in Java, rebinds the local name. The caller's
  array — the one the judge inspects — never changes. Write through the existing
  reference instead.
- **Slicing in Python.** `values[:] = values[-shift:] + values[:-shift]` does
  mutate in place and is correct, but it allocates two temporary lists, so it is
  `O(n)` space and fails the stated constraint.
- **`shift == 0` after the reduction.** Reversing `[0, -1]` must be a no-op, not
  an off-by-one. Both references return early.

## Why the naive approach is not enough

Shifting by one position `shift` times is `O(n * shift)`. At `n = 10^5` and
`shift = 10^9` that is not slow, it is never finishing.
