# Narrowest Range Covering K

## Approach

A range that covers every series is determined by a choice of one reading from
each: its ends are the smallest and largest of the chosen readings. So the
question is which choices are worth considering, and the answer is: walk them in
a fixed order and only ever advance the series that is holding the search back.

Keep one reading from each series — a **pointer per series** — with those
readings in a min-heap, and the largest of them tracked separately. The current
range is `[heap root, largest]`, and it covers everything by construction.

To improve it, the _only_ useful move is to advance the series whose reading is
the current low: every other series' reading is already at or above the low, so
advancing it can only push the high further out. So:

```
heap = min-heap of (series[i][0], i, 0) for every i
high = max of the first readings
best = [heap root, high]
loop:
    (low, which, at) = pop()
    if high - low < best.width: best = [low, high]
    if at + 1 == series[which].length: stop     # that series is exhausted
    next = series[which][at + 1]
    high = max(high, next)
    push((next, which, at + 1))
```

**Stopping is the subtle part.** Once one series has no readings left, every
range from then on would have to leave that series out, so nothing further can
be an answer. The loop ends there, not when the heap empties.

**Ties need no extra code.** The lows are visited in increasing order, so the
first range of a given width is also the one with the smallest low — a strict
`<` keeps it.

The heap holds `k` entries and each of the `N` readings enters once: `O(N log k)`
time, `O(k)` space. This is `merge-k-series` with a window over the merge rather
than an output list, and it is `min-window-cover` with "which series" in place of
"which letter".

## Complexity

- Time: `O(N log k)`.
- Space: `O(k)`.

## Pitfalls

- **Advancing the series holding the high.** It is the one move guaranteed not to
  help.
- **Continuing after a series is exhausted.** Every later range misses it.
- **Recomputing the high by scanning the pointers.** It only ever increases, so
  one comparison per step maintains it.
- **`<=` when comparing widths**, which reports the last narrowest range rather
  than the first.
