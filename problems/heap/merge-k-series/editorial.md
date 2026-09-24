# Merge K Ordered Series

## Approach

The next reading of the answer is always the smallest among the series' current
heads, and taking it changes that set of candidates by exactly one element. A
min-heap of the heads is the structure for that.

```
heap = min-heap of (first reading, series index, 0) for every non-empty series
while heap is not empty:
    (value, which, at) = pop()
    out.append(value)
    if at + 1 < series[which].length:
        push((series[which][at + 1], which, at + 1))
```

The heap holds at most `k` entries and each of the `N` readings is pushed and
popped once: `O(N log k)` time, `O(k)` space.

**Three answers, and which one is right depends on why you are asking.**

- **Concatenate and sort.** `O(N log N)`, one line, and genuinely the best answer
  when everything already fits in memory — `N log N` and `N log k` differ by a
  constant factor that a highly optimised sort usually wins back. Say so rather
  than pretending otherwise.
- **The heap.** `O(N log k)` and `O(k)` space. The reason to prefer it is that it
  never needs more than one reading per series at a time, so it works when the
  series are files, database cursors or network streams too large to hold. That
  is what a k-way merge is _for_, and why external sorting is built on it.
- **A tournament of pairwise merges.** `O(N log k)` with no heap, and the shape
  merge sort itself uses.

**The answer to avoid** is merging the series one at a time into a growing
result: that re-walks everything already merged, `O(k · N)`, which at the stated
maxima is fifty million steps. Python does not finish that inside the time
limit; Java's JIT gets through it, so there the target complexity is the bar rather than the clock.

In Python a heap of bare tuples works because the tie-breaker — the series index
— is comparable; a heap of `(value, list)` raises when two values are equal.

## Complexity

- Time: `O(N log k)`.
- Space: `O(k)`.

## Pitfalls

- **Seeding the heap with empty series.** There is no head to key on.
- **Folding the series in one at a time.** The `O(k · N)` answer.
- **A heap whose entries are not totally ordered.** The tie-break has to exist.
- **Assuming at least one series.** The outer list may be empty.
