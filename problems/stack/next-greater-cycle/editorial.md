# Next Greater, Wrapping

## Approach

Start without the ring. Walking left to right and keeping the positions whose
answer is still unknown, those positions are always in **decreasing** order of
value — because if a waiting position held a smaller value than a later waiting
one, the later one would already have answered it. That is the monotonic stack,
and the invariant *is* the algorithm:

```
for each position j:
    while the stack is not empty and readings[stack.top] < readings[j]:
        answer[stack.pop()] = readings[j]
    push j
```

Each position is pushed once and popped at most once, so the pass is `O(n)`
despite the inner loop.

The ring is one line of change: walk `2n` steps, using `j = i mod n`, and **only
push during the first lap**. The second lap answers anything still waiting — a
position's answer, if it exists at all, is within one full turn — without adding
positions that would never be answered. Whatever is still on the stack when the
walk ends has no greater reading anywhere, and keeps its `-1`.

The comparison is `<`, not `<=`, because "greater" is strict: a run of equal
readings must not answer itself, which Example 2 pins down.

## Complexity

- Time: `O(n)`.
- Space: `O(n)` for the stack and the answer.

## Pitfalls

- **Scanning forward from each position.** `O(n^2)` in the straight version, and
  the ring makes the constant worse.
- **Pushing during the second lap.** Positions from the second lap can never be
  answered correctly and pollute the stack.
- **Using `<=`.** Equal readings would answer each other, which is not what
  "strictly greater" means.
- **Storing values on the stack rather than positions.** The answer has to be
  written back at a position, and two equal values are indistinguishable by
  value.
