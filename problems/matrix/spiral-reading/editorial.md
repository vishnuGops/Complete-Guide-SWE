# Read It In A Spiral

## Approach

A spiral is a sequence of rings, and each ring is four straight runs. Track four
boundaries — `top`, `bottom`, `left`, `right` — and after each run move the
boundary it just consumed:

```
while top <= bottom and left <= right:
    for c in left..right:  take grid[top][c]
    top += 1

    for r in top..bottom:  take grid[r][right]
    right -= 1

    if top <= bottom:
        for c in right..left step -1:  take grid[bottom][c]
        bottom -= 1

    if left <= right:
        for r in bottom..top step -1:  take grid[r][left]
        left += 1
```

The two inner checks are the whole difficulty. After the first two runs the ring
may already be exhausted:

- A ring one row thick has had its only row read by the first run, so the third
  run would read that row again backwards. `top <= bottom` stops it.
- A ring one column thick is the mirror image, and `left <= right` stops that.

The outer loop's condition is not enough on its own, because it is only checked
between rings, and a ring can run out in the middle.

Every cell is taken exactly once, so the result's length is its own check: if an
implementation returns more values than the grid holds, it is reading a run
twice, and that is always one of these two.

## Complexity

- Time: `O(rows · columns)`.
- Space: `O(1)` beyond the output.

## Pitfalls

- **Omitting the inner checks.** A single row comes back as `[1,2,3,4,3,2,1]`.
- **Marking cells as visited instead.** It works and costs `O(rows · columns)`
  extra space for something four integers already tell you.
- **Moving a boundary before its run finishes.** Each boundary moves once, after
  its run.
- **Assuming the grid is square.** Rows and columns run out at different times,
  which is exactly what the four boundaries are for.
