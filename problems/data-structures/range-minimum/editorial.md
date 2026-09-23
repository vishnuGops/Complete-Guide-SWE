# Smallest In Any Range

## Approach

**Why the Fenwick trick does not apply.** `range-sum-mutable` answers a stretch
by subtracting one prefix from another, which works because addition has an
inverse. Minimum does not: knowing the smallest of `readings[0..to]` and of
`readings[0..from-1]` tells you nothing about the stretch in between. The
structure has to _cover_ the queried stretch rather than reconstruct it by
cancellation.

**A segment tree** does that. Each node covers a stretch and stores its smallest
reading; the leaves cover single positions and each internal node covers the
union of its two children, storing the smaller of their two values.

Stored as a flat array of size `2n`, with the leaves at `n .. 2n-1` and the
parent of `i` at `i / 2`, both operations are short loops:

```
set(at, value):
    i = at + n; tree[i] = value
    while i > 1: i /= 2; tree[i] = min(tree[2i], tree[2i + 1])

smallest(from, to):
    best = +infinity
    left = from + n; right = to + n + 1          # half-open
    while left < right:
        if left is odd:  best = min(best, tree[left]);  left += 1
        if right is odd: right -= 1; best = min(best, tree[right])
        left /= 2; right /= 2
    return best
```

**The odd tests are what pick out the covering nodes.** A left boundary that is a
right-hand child cannot be extended upwards without including its sibling, so
that node is taken and the boundary moves on; the same argument mirrored applies
on the right. Everything else is absorbed into a parent. At most two nodes are
taken per level, so a query is `O(log n)`.

**The bottom-up form has no recursion and no lazy machinery**, which makes it the
one worth memorising for point updates. Range _updates_ — "add 5 to everything
between here and there" — need the recursive form with lazy propagation, and that
is the next thing to learn after this.

**A segment tree answers sums too**, by storing sums instead of minima; the
Fenwick tree is smaller and faster for that one case, which is why both exist.

## Complexity

- Time: `O(log n)` per operation, `O(n)` to build.
- Space: `O(n)`.

## Pitfalls

- **Trying to subtract prefixes.** Minimum has no inverse.
- **An inclusive right boundary in the query loop.** The loop is written
  half-open; mixing the two is the classic off-by-one.
- **Forgetting to rebuild the ancestors after a change.** Only the path to the
  root is affected, and all of it is.
- **An identity of 0 rather than infinity.** Every negative reading would be
  hidden by it.
