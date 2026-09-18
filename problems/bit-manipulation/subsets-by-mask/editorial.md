# Subsets Without Recursion

## Approach

A subset is a yes-or-no choice per value, and so is a binary number. With `n`
values there are `2^n` subsets and `2^n` numbers of `n` bits, and the
correspondence is the obvious one: **bit `i` of `m` set means `values[i]` is in
subset `m`**.

So the recursion disappears entirely:

```
for m in 0 .. (1 << n) - 1:
    subset = []
    for i in 0 .. n-1:
        if m >> i & 1: subset.append(values[i])
    record subset
```

Two loops, `O(n · 2^n)` — the size of the output — and no stack, no backtracking,
no working list to undo.

**Why this is worth having alongside `all-subsets`.** The recursive version is
the one to reach for when the subsets need pruning, or when the choices are not
independent. This one is the one to reach for when the subsets are *data*: it
gives each subset a number, which means subsets can be stored in an array,
compared, used as keys, and — most importantly — used as indices into a table.
That last use is what `travel-all-cities` is built on, where "the set of cities
visited" is an array index rather than a collection.

**Counting up gives the required order for free**, and reading the bits from low
to high gives the required order within each subset. Neither needs sorting.

**`1 << n` for `n = 14`** is 16384 subsets, and the output is the reason the
bound is small; the method itself is fine up to about 20.

## Complexity

- Time: `O(n · 2^n)`.
- Space: `O(1)` beyond the output.

## Pitfalls

- **Reading the bits from high to low.** The subsets come out in the wrong
  internal order.
- **Looping `m` to `1 << n` inclusive.** That is one subset too many.
- **`1 << n` for large `n` in a 32-bit type.** Not an issue at 14, and the
  general hazard behind this technique.
