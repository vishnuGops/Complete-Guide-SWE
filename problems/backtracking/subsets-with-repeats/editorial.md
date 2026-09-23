# Subsets Without Repeats

## Approach

Start from the recursion that produces every subset — for each position, take it
or leave it. It produces duplicates exactly when two equal values sit at
different positions: taking the first and taking the second build the same
subset.

**Sorting brings the equal values together**, and then one rule removes every
duplicate:

```
build(start):
    record a copy of chosen
    for i in start .. n-1:
        if i > start and values[i] == values[i-1]: continue   # not the first of its run
        chosen.append(values[i])
        build(i + 1)
        chosen.pop()
```

At a given level, a run of equal values may be entered only at its first member.
Taking a _later_ member would produce a subset already reachable by taking the
first, so it is skipped; but taking _more_ of the run is still possible, because
the deeper level starts at `i + 1` and its own `i > start` test lets it in.

**`i > start`, not `i > 0`.** This is the line that is always written wrong. With
`i > 0` the second 2 of `[1, 2, 2]` could never be chosen at all, and `[2, 2]`
disappears from the answer. The test is about being a repeat _within this level's
choices_, not about being a repeat in the list.

Recording at the top of the call rather than at a base case is a small
simplification: every node of the recursion is itself a subset, so there is no
separate "ran out of values" case.

## Complexity

- Time: `O(n · 2^n)` in the worst case, when nothing repeats.
- Space: `O(n)` besides the answer.

## Pitfalls

- **`i > 0` instead of `i > start`.** Whole subsets vanish.
- **De-duplicating at the end with a set.** It works, it costs the full `2^n`
  first, and it needs a canonical form for each subset to hash on.
- **Forgetting to sort.** The rule depends on equal values being adjacent.
- **Recording without copying**, and **forgetting the pop**.
