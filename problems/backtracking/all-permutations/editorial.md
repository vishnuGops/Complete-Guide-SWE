# Every Ordering

## Approach

Build the ordering one position at a time. For the first position any value may
be chosen; for the second, any of the rest; and so on — `n!` orderings in total,
which is why `n` is capped at 7 (5040 answers).

```
build(chosen, used):
    if chosen.length == n:
        record a copy
        return
    for i in 0 .. n-1:
        if used[i]: continue
        used[i] = true;  chosen.append(values[i])
        build(chosen, used)
        chosen.pop();    used[i] = false      # undo
```

The shape is the same as `all-subsets` — choose, recurse, undo — with a loop over
the choices instead of a yes/no pair. That is the whole difference between
permutations and subsets, and it is worth seeing written down.

**The swap version.** Instead of a `used` list, swap the chosen value into the
current position and recurse on the rest:

```
build(at):
    if at == n: record a copy; return
    for i in at .. n-1:
        swap(values[at], values[i])
        build(at + 1)
        swap(values[at], values[i])          # undo
```

No extra memory, and the undo is the same swap repeated. It changes the input
while it runs and restores it, which is worth knowing about before using it on
something the caller still needs.

**With repeated values** neither version is right on its own: both would produce
the same ordering several times. Sorting first and skipping a choice equal to the
previous unused one fixes it — the technique `subsets-with-repeats` is about.
This problem has distinct values so the question does not arise.

## Complexity

- Time: `O(n · n!)` — the output is that size.
- Space: `O(n)` besides the answer.

## Pitfalls

- **Forgetting either undo.** The `used` flag and the working list both have to
  be restored; missing one silently drops most of the answers.
- **Recording without copying.**
- **Recursing on the remaining values by building a new list each time.** It
  works and allocates `O(n)` per node of the recursion tree.
