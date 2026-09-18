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

Input: `heights = [2, 1, 5, 6, 2, 3]`

Output: `10`

The columns of height 5 and 6 together give a rectangle 2 wide and 5 tall.

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
is a hundred million spans and it will not finish.
