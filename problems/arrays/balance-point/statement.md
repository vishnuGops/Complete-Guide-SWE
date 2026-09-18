Weights are laid out along a beam, one weight per position. The beam balances at
position `i` when everything strictly to the left of `i` weighs exactly as much
as everything strictly to the right of it. The weight at `i` itself sits on the
pivot and counts for neither side.

Return the smallest index where the beam balances, or `-1` if no position does.

An empty side weighs `0`, so index `0` balances whenever everything after it sums
to zero.

## Input

- `values` - a list of integers, the weight at each position; weights may be
  negative or zero

## Output

The smallest balancing index, or `-1` when there is none.

## Constraints

- `0 <= values.length <= 10000`
- `-10^6 <= values[i] <= 10^6`
- An empty row has no positions at all, so its answer is `-1`.

## Examples

### Example 1

Input: `values = [2, 3, -1, 8, 4]`

Output: `3`

Left of index 3: `2 + 3 - 1 = 4`. Right of it: `4`. Indices 0, 1 and 2 do not
balance, so 3 is the smallest that does.

### Example 2

Input: `values = [1, 2, 3]`

Output: `-1`

The three splits are `0 | 2 + 3`, `1 | 3` and `1 + 2 | 0`, and none of them match.

### Example 3

Input: `values = [0]`

Output: `0`

Both sides are empty, and empty weighs nothing.
