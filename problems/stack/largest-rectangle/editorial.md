# Widest Solid Block

## Approach

Rectangles are hard to enumerate; columns are not. So change the question: for
each column `i`, what is the largest rectangle whose height is exactly
`heights[i]`?

It extends left until a strictly shorter column blocks it and right until the
same happens, so its area is `heights[i] × (right - left - 1)`. Every rectangle
that fits is the answer for at least one column — the shortest column it spans —
so the largest over all `i` is the answer.

Finding both boundaries for every column is the job of a **monotonic stack**.
Walk left to right, keeping the positions whose right boundary is not yet known.
Those positions always hold **increasing** heights: a position can only still be
waiting if nothing shorter has arrived since.

When a column of height `h` arrives, every waiting position taller than `h` is
settled — `h` is its right boundary — so it is popped and its area computed. The
left boundary is one past whatever remains below it on the stack, because that is
the nearest earlier position that is shorter.

```
stack = empty            # positions, increasing heights
for i in 0 .. n:         # n is one past the end, with height 0
    current = (i < n) ? heights[i] : 0
    while stack not empty and heights[stack.top] >= current:
        height = heights[stack.pop()]
        left   = stack.empty ? 0 : stack.top + 1
        best   = max(best, height * (i - left))
    stack.push(i)
```

The **sentinel** — a column of height 0 one past the end — is what settles
everything still waiting when the row runs out, instead of a second loop.

Each position is pushed once and popped once, so the pass is `O(n)` despite the
inner loop.

## Complexity

- Time: `O(n)`.
- Space: `O(n)`.

## Pitfalls

- **Trying every span.** `O(n^2)`, which Python does not finish at the stated
  maximum. Java's JIT gets through it, so there the target complexity is the bar rather than the clock.
- **Forgetting the sentinel.** A row that only increases — `[1,2,3]` — leaves
  everything on the stack and answers 0.
- **Getting the width wrong.** It is `i - left`, where `left` is one past the
  position below on the stack, _not_ `i - poppedPosition`.
- **Zero heights.** They are allowed, they settle everything before them, and
  their own area is zero.
