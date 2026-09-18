# Sums That Keep Changing

## Approach

The two obvious designs each fail one operation:

- **The plain row** — `set` is `O(1)`, `total` is `O(n)`.
- **Running totals** — `total` is `O(1)`, `set` is `O(n)`, because every running
  total after the changed position is wrong.

What is needed is something between: partial sums over *blocks*, so that a change
touches few blocks and a total is assembled from few blocks.

**A Fenwick tree** (a binary indexed tree) does it with one array and no explicit
tree. Index `i` of the array stores the sum of the `i & -i` readings ending at
`i` — a block whose size is the lowest set bit of `i`. Two walks follow from
that:

```
add(at, delta):                # position `at` is 1-based here
    while at <= n: tree[at] += delta; at += at & -at

prefix(at):                    # the sum of the first `at` readings
    total = 0
    while at > 0: total += tree[at]; at -= at & -at
    return total
```

Each walk visits one index per set bit — at most `log n` steps — because `at &
-at` either clears the lowest set bit (going down) or carries it (going up). The
same `x & -x` that isolated a bit in `two-lonely-numbers` is doing the work here.

`total(from, to)` is `prefix(to + 1) - prefix(from)`, which is the running-total
subtraction from `balance-point`, applied to a structure that can also be
changed.

**`set` is not `add`.** The tree stores sums, so replacing a reading means adding
the *difference* — which is why the original values have to be kept alongside the
tree.

**The one-based indexing is not decoration.** `at & -at` is zero at index 0, so
the walk would not move; the array is one longer and every position is shifted by
one. Nearly every Fenwick bug is here.

A segment tree — `range-minimum`'s structure — answers this too, in more code and
more memory, and generalises to operations the Fenwick trick cannot express.

## Complexity

- Time: `O(log n)` per operation.
- Space: `O(n)`.

## Pitfalls

- **Zero-based indexing.** The walk stalls at 0.
- **Storing the new value rather than the difference.** The sums become nonsense.
- **Forgetting to keep the plain values.** The difference cannot be computed
  without them.
- **An inclusive `to`.** The prefix call is `prefix(to + 1)`.
