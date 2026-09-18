# An Order That Works

## Approach

Model the rules as a directed graph: `[a, b]` is an edge from `a` to `b`. A valid
order is a **topological order** — every edge points forwards.

**Kahn's algorithm** builds one directly. For each course keep `waiting`, the
number of prerequisites not yet taken:

```
available = every course with waiting == 0
while available is not empty:
    take one, append it to the order
    for each course it unlocks:
        waiting -= 1
        if waiting == 0: it becomes available
```

Each course is taken once and each rule is used once: `O(n + rules)`.

**Detecting impossibility is free.** If the order ends up shorter than `n`, the
courses left all still have unmet prerequisites — which can only happen if they
depend on each other in a cycle. No separate cycle check is needed.

**The smallest order** is a one-word change: keep `available` in a **min-heap**
instead of a queue, so the lowest-numbered available course is always taken.
That is what makes the answer unique, and it costs `O(n log n)`. A plain queue
gives *a* valid order, which is what the problem would ask for if any answer were
accepted; here it usually gives the wrong one.

**The trap** is scanning all `n` courses at each step to find an available one.
That is `O(n^2)` — a hundred million checks at the stated maximum — for
something the `waiting` counts already say.

Depth-first search is the other standard answer: post-order, reversed, gives a
topological order, and grey/black colouring detects the cycle. It cannot easily
be made to produce the *smallest* order, which is why this problem is stated for
Kahn's.

## Complexity

- Time: `O(n log n + rules)`.
- Space: `O(n + rules)`.

## Pitfalls

- **A queue instead of a heap.** A valid order, and not the one asked for.
- **Counting the wrong direction.** `[a, b]` means `b` waits for `a`, so the
  count belongs on `b`.
- **Returning a partial order when a cycle exists.** The answer is the empty
  list.
- **Re-scanning for available courses.**
