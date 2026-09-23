# What Fits In The Bag

## Approach

For each item there are two choices, and the rest of the problem is the same
question with fewer items:

```
best(i, c) = best(i-1, c)                                     # skip item i
           = max(that, best(i-1, c - weight[i]) + worth[i])   # take it, if it fits
best(0, c) = 0
```

Filled as a table over `(items considered, capacity)` that is `O(n · capacity)` —
at most a hundred thousand cells here.

**Rolled into one row**, the loop direction carries the whole meaning:

```
best = [0] * (capacity + 1)
for i in items:
    for c from capacity down to weight[i]:      # DOWNWARDS
        best[c] = max(best[c], best[c - weight[i]] + worth[i])
```

Downwards, `best[c - weight[i]]` still holds the value from _before_ this item
was considered, so the item is used at most once. Upwards, it would already
include this item, and the item could be taken repeatedly — which is the
_unbounded_ knapsack, the same table as `coin-ways`. One loop direction, two
different problems; that pairing is the thing to remember.

**Why greedy fails.** Sorting by worth per unit weight and taking greedily is
optimal for the _fractional_ problem, where an item can be cut. It is not optimal
here: in Example 1 the weight-1 item has the best ratio and is not in the answer,
because taking it leaves a capacity that nothing fills well. The moment items are
indivisible, exchange arguments stop working and the table is needed.

**`partition-equal-halves` is this problem** with worth equal to weight and the
question reduced to a boolean.

## Complexity

- Time: `O(n · capacity)`.
- Space: `O(capacity)`.

## Pitfalls

- **The inner loop upwards.** Items get taken more than once.
- **Greed by ratio.** Optimal only when items can be cut.
- **`capacity = 0`.** The answer is 0, and the loop simply never runs.
- **Trying every subset.** `2^100`.
