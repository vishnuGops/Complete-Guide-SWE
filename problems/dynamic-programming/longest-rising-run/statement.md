Pick readings from the row, keeping their order but not necessarily their
adjacency, so that each is **strictly larger** than the one before. Report the
most readings you can pick.

## Input

- `readings` — a list of integers

## Output

The length of the longest strictly increasing subsequence.

## Constraints

- `1 <= readings.length <= 10^5`
- `-10^9 <= readings[i] <= 10^9`

## Examples

### Example 1

Input: `readings = [6, 2, 8, 3, 9, 4, 1, 12]`

Output: `4`

`2, 3, 4, 12` — or `6, 8, 9, 12`, which is also four.

### Example 2

Input: `readings = [7, 7, 7]`

Output: `1`

Equal is not larger, so only one reading can be picked.

### Example 3

Input: `readings = [5, 4, 3, 2, 1]`

Output: `1`

## Notes

The natural table — for each position, the longest run ending there, found by
looking back at every earlier position — is `O(n^2)`. At the stated maximum that
is ten billion comparisons and it will not finish.
