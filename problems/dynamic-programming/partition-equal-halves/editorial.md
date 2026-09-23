# Split Into Equal Halves

## Approach

**Halve the question first.** If the two groups have equal totals, each is half
of everything — so the question "can these be divided evenly" is exactly "is some
subset's total equal to `sum / 2`". The second group needs no thought at all; it
is whatever is left.

And if the total is odd, no subset can reach half of it. That single check
disposes of a great many inputs before anything else runs.

**Then it is a subset-sum table.** `reachable[t]` means "some subset of the
values seen so far totals `t`":

```
reachable[0] = true                  # the empty subset
for value in values:
    for t from half down to value:   # DOWNWARDS
        reachable[t] |= reachable[t - value]
return reachable[half]
```

**The inner loop runs downwards, and that is the whole trick.** Each value may be
used at most once, and `reachable[t - value]` must therefore describe totals
built _without_ this value. Going downwards means that cell has not yet been
touched this round; going upwards would let a value be spent twice — which is
`coin-ways`'s unlimited-supply loop, a different problem.

That one direction is the difference between the bounded and unbounded knapsack,
and it is worth learning as a pair rather than as two facts.

`O(n · total)` time — at most 200 × 10000 = two million cell updates — and
`O(total)` space.

**In a language with big integers**, the whole row is a bitset: `reachable |=
reachable << value` does one value in a single shift-and-or, which is both
shorter and much faster. Worth knowing; the explicit loop is what shows the
direction.

## Complexity

- Time: `O(n · total)`.
- Space: `O(total)`.

## Pitfalls

- **Running the inner loop upwards.** Values get reused and `[1, 1, 1]` comes out
  splittable.
- **Forgetting the odd-total check.** Not wrong, but the table then searches for
  a half that does not exist.
- **Trying every subset.** `2^200`.
- **Assuming a single value can be split.** Each value goes wholly into one
  group.
