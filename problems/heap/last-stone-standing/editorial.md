# What Is Left Of The Stones

## Approach

The rule names the two heaviest stones, and after each round the pile changes by
a small amount: two stones out, at most one in. That is exactly what a heap is
for.

```
heap = max-heap of the stones
while heap holds at least two:
    a = pop(); b = pop()          # the two heaviest, in that order
    if a != b: push(a - b)
return heap is empty ? 0 : pop()
```

Each round is `O(log n)` and there are at most `n - 1` rounds, so the whole thing
is `O(n log n)` — the same as the initial heapify, which can be done in `O(n)` if
it matters.

The alternative — keep the stones in a sorted list and re-sort after each round —
is `O(n log n)` *per round*. Inserting the new stone into its place in a sorted
list is better, `O(n)` per round from the shifting, and still worse than the
heap.

Pushing a zero back when the two stones are equal is harmless: a zero can only
become one of the two heaviest once nothing else is left, and at that point the
answer is zero either way. Not pushing it is tidier.

**Python has no max-heap**, which is worth saying out loud: `heapq` is a min-heap,
so the usual trick is to negate every weight going in and negate again coming
out. Java's `PriorityQueue` takes a comparator, so `Collections.reverseOrder()`
does it.

## Complexity

- Time: `O(n log n)`.
- Space: `O(n)`.

## Pitfalls

- **Taking any two stones rather than the two heaviest.** The answer depends on
  the order, and the rule is specific.
- **Pushing `b - a` instead of `a - b`.** The first pop is the heavier one.
- **Forgetting the empty case.** Every stone can be destroyed.
- **Using `heapq` as if it were a max-heap.** It is not; negate.
