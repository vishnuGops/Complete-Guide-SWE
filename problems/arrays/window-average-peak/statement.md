A dashboard charts a rolling window of `width` consecutive readings. It needs to
highlight the window whose readings add up to the most.

Return the **starting index** of that window. If two windows tie on total, return
the smaller starting index.

## Input

- `values` - a list of integers, the readings in the order they were recorded
- `width` - the number of consecutive readings in a window

## Output

The index where the highest-total window begins.

## Constraints

- `1 <= width <= values.length <= 8000`
- `-10^6 <= values[i] <= 10^6`
- Recomputing each window from scratch costs `O(n * width)` and will not finish
  the largest tests in time.

## Examples

### Example 1

Input: `values = [1, 2, 3, 4]`, `width = 2`

Output: `2`

The three windows total `3`, `5` and `7`. The last one wins and starts at index 2.

### Example 2

Input: `values = [5, -1, -1, 5]`, `width = 2`

Output: `0`

The windows total `4`, `-2` and `4`. The first and last tie, so the smaller
starting index wins.

### Example 3

Input: `values = [-3]`, `width = 1`

Output: `0`

There is only one window, and a negative total is still the best available.
