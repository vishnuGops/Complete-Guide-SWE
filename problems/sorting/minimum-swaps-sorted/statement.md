You may swap any two readings, however far apart. Report the fewest swaps needed
to put the row into ascending order.

All the readings are different, so the sorted order is unambiguous.

## Input

- `readings` — a list of distinct integers

## Output

The smallest number of swaps that sorts `readings` ascending.

## Constraints

- `1 <= readings.length <= 10^5`
- `-10^9 <= readings[i] <= 10^9`
- All readings are distinct.

## Examples

### Example 1

Input: `readings = [4, 3, 2, 1]`

Output: `2`

Swap the 4 and the 1, then the 3 and the 2.

### Example 2

Input: `readings = [1, 5, 4, 3, 2]`

Output: `2`

The 1 is already home. Swapping 5 with 2 and 4 with 3 finishes it.

### Example 3

Input: `readings = [1, 2, 3]`

Output: `0`

Already sorted.

## Notes

Simulating a selection sort — repeatedly swapping the smallest remaining reading
into place — happens to use the fewest swaps, but finding the smallest each time
is `O(n^2)`. At the stated maximum that is billions of comparisons and will not
finish.
