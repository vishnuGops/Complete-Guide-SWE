# Everything But Me

## Approach

The answer at position `i` is

```
(readings[0] · … · readings[i-1]) · (readings[i+1] · … · readings[n-1])
```

— a prefix and a suffix, neither of which contains `readings[i]`. Both are
running products, so both are available in one sweep each.

The first sweep goes left to right and writes into `out[i]` the product of
everything strictly before `i`, carrying that product in a single variable. The
second sweep goes right to left, multiplying each `out[i]` by the product of
everything strictly after `i`, carried in the same way.

Nothing is stored except the output and two integers. That is why the zeroes
need no special handling: a zero simply makes every prefix or suffix that
contains it zero, and the one position whose answer excludes it still gets the
right product.

## Complexity

- Time: `O(n)` — two passes.
- Space: `O(1)` beyond the output.

## Pitfalls

- **Dividing the total product.** It is the first thing that comes to mind and
  it breaks on zeroes: one zero needs a special case, two zeroes need another,
  and the problem asks you not to.
- **Recomputing a product per position.** Multiplying the other `n-1` readings
  for each position is `O(n^2)`; at the stated maximum that is a hundred
  million multiplications, which does not finish here.
- **Counting the output as extra space.** It is the answer, not scratch space —
  but a second array of prefix products _is_ scratch, and is avoidable.
