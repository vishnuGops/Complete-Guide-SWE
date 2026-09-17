Parcels are queued by weight, lightest first. Two parcels can share a crate when
their weights add up to at most `limit`.

Count how many different pairs of parcels could share a crate. A pair is two
distinct positions in the queue, and the pair at positions `i` and `j` is the
same pair as the one at `j` and `i`.

## Input

- `weights` - a list of integers sorted in non-decreasing order
- `limit` - the largest combined weight a crate can take

## Output

The number of pairs whose weights sum to `limit` or less.

## Constraints

- `0 <= weights.length <= 10000`
- `-10^4 <= weights[i] <= 10^4`, and the list is sorted non-decreasing
- `-10^9 <= limit <= 10^9`
- Weights may repeat, and two parcels of the same weight at different positions
  are a pair.
- Testing every pair is `O(n^2)` and will not finish the largest tests in time.

## Examples

### Example 1

Input: `weights = [1, 2, 3, 4]`, `limit = 5`
Output: `4`

`1+2`, `1+3`, `1+4` and `2+3` all fit. `2+4` and `3+4` do not.

### Example 2

Input: `weights = [-3, 0, 2]`, `limit = 0`
Output: `2`

`-3+0` and `-3+2` fit; `0+2` does not.

### Example 3

Input: `weights = [5, 5]`, `limit = 9`
Output: `0`

The only pair weighs 10, which is over the limit.
