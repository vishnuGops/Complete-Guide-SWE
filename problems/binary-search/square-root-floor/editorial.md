# Whole Square Root

## Approach

The candidates are the integers `0 .. 46340` (because `46341^2` already exceeds
the largest allowed `value`), and the predicate `r * r <= value` is true for a
prefix of them and false for the rest. So this is a boundary search over the
*answer*, not over any input array — the "binary search on the answer" pattern in
its smallest form.

```
low, high = 0, 46340
while low < high:
    mid = low + (high - low + 1) // 2   # rounded UP
    if mid * mid <= value:
        low = mid
    else:
        high = mid - 1
return low
```

Two things are worth spelling out.

**Rounding the midpoint up.** This loop keeps the candidate that satisfies the
predicate (`low = mid`, not `mid + 1`). With the midpoint rounded down, `low` and
`mid` coincide when `high == low + 1`, and the loop spins forever. The rule: if
one branch assigns `low = mid`, round up; if a branch assigns `high = mid`, round
down.

**Why not `sqrt`.** `Math.sqrt` returns a `double`, which has 53 bits of
mantissa — enough for every value here, but the *conversion back* is where it
goes wrong: `(int) Math.sqrt(2147395600)` can land on 46339 or 46341 depending
on the platform's rounding, and the usual fix is a correction step that ends up
being this search's last iteration anyway. Integer arithmetic is exact and
needs no apology.

Newton's method converges faster and is the right answer for very large
integers; at 31 bits the sixteen steps of a binary search are already nothing.

## Complexity

- Time: `O(log n)` — sixteen iterations at most.
- Space: `O(1)`.

## Pitfalls

- **Overflow in `mid * mid`.** In Java, `mid` up to 46340 squares to 2147395600,
  which just fits in an `int`; widen to `long` rather than relying on that, since
  a slightly wider search range overflows silently.
- **Rounding the midpoint down.** An infinite loop, and the most common way to
  get this exact problem wrong.
- **Searching up to `value`.** Harmless for correctness but it makes the
  multiplication overflow for large values in fixed-width arithmetic.
- **Forgetting 0 and 1.** Both are their own whole square roots.
