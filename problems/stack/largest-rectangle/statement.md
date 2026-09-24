A row of columns stands side by side, each one unit wide and `heights[i]` units
tall. Find the area of the largest solid rectangle that fits inside them.

The rectangle must be made of whole columns standing next to each other, and its
height is limited by the shortest column it spans.

## Input

- `heights` — the column heights, left to right

## Output

The area of the largest rectangle that fits.

## Constraints

- `1 <= heights.length <= 10^4`
- `0 <= heights[i] <= 10^4`

## Examples

### Example 1

Input: `heights = [1, 3, 6, 7, 2, 4]`

Output: `12`

The columns of height 6 and 7 together give a rectangle 2 wide and 6 tall. The
widest options, 2 tall across five columns or 1 tall across six, reach only 10
and 6.

### Example 2

Input: `heights = [2, 2, 2]`

Output: `6`

All three columns at their full height.

### Example 3

Input: `heights = [5]`

Output: `5`

One column is its own rectangle.

## Notes

Trying every pair of left and right edges is `O(n^2)`. At the stated maximum that
is fifty million spans: too slow for the time limit in Python, though Java's JIT
gets through it. Either way it misses the `O(n)` target.
