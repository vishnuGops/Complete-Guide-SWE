# Rooms At Once

## Approach

The answer is the maximum, over all moments, of how many bookings are in
progress. Two observations shrink that to something finite and fast.

**The busiest moment is a start.** Between one start and the next, no booking
begins, so the count can only fall. So it is enough to evaluate the count at each
of the `n` start times.

**Starts and ends can be considered separately.** The count in progress at
moment `t` is (starts at or before `t`) minus (ends at or before `t`), and
neither term cares which booking it came from. So sort the start times, sort the
end times, and sweep:

```
ends_index = 0, in_progress = 0, best = 0
for each start in sorted starts:
    while ends[ends_index] <= start:   # those rooms are free again
        ends_index += 1
        in_progress -= 1
    in_progress += 1
    best = max(best, in_progress)
```

The `<=` is what makes back-to-back bookings share a room; `<` would give the
wrong answer on Example 3.

The heap phrasing is the same algorithm with the ends kept in a priority queue
instead of a sorted array: process bookings in start order, pop every end that
has passed, push this booking's end, and the heap size is the rooms in use. It
costs the same `O(n log n)` and is worth knowing because it extends to "which
room" rather than "how many".

## Complexity

- Time: `O(n log n)`, dominated by the two sorts.
- Space: `O(n)` for the sorted times.

## Pitfalls

- **Comparing every pair.** `O(n^2)` and does not finish at the stated maximum.
- **Counting per minute.** A timeline array is the obvious sweep and the times
  run to `10^9`; it does not fit and does not finish.
- **Treating touching bookings as overlapping.** `ends[j] <= start`, not `<`.
- **Sorting the pairs and comparing neighbours.** That answers "do any two
  overlap", not "how many at once"; three bookings can pairwise overlap in a
  chain while only two are ever in progress together.
