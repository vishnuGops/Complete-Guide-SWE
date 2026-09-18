# K Cheapest Pairings

## Approach

Picture the pairings as a grid: cell `(i, j)` costs `first[i] + second[j]`.
Because both lists are sorted, cost **only increases** as you move right along a
row or down a column. The grid is therefore sorted in both directions, and the
cheapest cell not yet taken is always immediately right of, or immediately below,
a cell already taken.

That is the k-way merge again: each row is a sorted series, and the answer is the
`k` smallest values across all of them.

```
heap = min-heap of (first[i] + second[0], i, 0) for i in 0 .. min(k, n) - 1
while heap is not empty and fewer than k taken:
    (cost, i, j) = pop()
    take (first[i], second[j])
    if j + 1 < second.length: push((first[i] + second[j+1], i, j + 1))
```

Two details:

- **Seed only the first `min(k, n)` rows.** Row `k` and beyond cannot appear in
  the answer: row `i`'s cheapest pairing is at least as dear as row `i-1`'s, so
  rows `0 .. k-1` already supply `k` candidates no dearer than anything below.
  Seeding all `n` rows still works and wastes `O(n)` when `n` is large.
- **Push only rightwards.** Pushing both right and down would reach each cell
  from two directions and needs a visited set; seeding the whole first column
  instead makes every cell reachable exactly once, from the left.

The heap never holds more than `k` entries and pops `k` times: `O(k log k)`.

**The trap** is building all `n · m` pairings and sorting them. At the stated
maxima that is `10^8` pairs, which does not finish and does not fit — and it is
unnecessary, since at most `k` cells are ever candidates.

The ordering rule needs no extra work here: the lists have no repeated prices, so
ordering by `(cost, i, j)` is exactly ordering by `(cost, a, b)`.

## Complexity

- Time: `O(k log k)`.
- Space: `O(k)`.

## Pitfalls

- **Enumerating every pairing.**
- **Pushing both neighbours without a visited set.** Cell `(i, j)` is then taken
  twice.
- **Seeding the first *row* instead of the first column**, then pushing
  downwards. That works too — it is the mirror image — but mixing the two does
  not.
- **Stopping when the heap empties rather than at `k`.** Both conditions are
  needed: `k` is capped at `n · m`, so the heap can empty exactly as the answer
  fills.
