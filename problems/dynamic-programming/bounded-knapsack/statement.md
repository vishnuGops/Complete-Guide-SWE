A bag holds at most `capacity` units of weight. Each item may be taken at most
once, and taking it adds its weight and its worth.

Report the greatest total worth that fits.

## Input

- `weights` — each item's weight
- `worths` — each item's worth, in the same order
- `capacity` — how much weight the bag holds

## Output

The greatest total worth of a set of items whose total weight is at most
`capacity`.

## Constraints

- `1 <= weights.length <= 100`
- `weights.length == worths.length`
- `1 <= weights[i] <= 1000`
- `1 <= worths[i] <= 1000`
- `0 <= capacity <= 1000`

## Examples

### Example 1

Input: `weights = [1, 3, 4, 5]`, `worths = [1, 4, 5, 7]`, `capacity = 7`

Output: `9`

Items 2 and 3: weight 3 + 4 = 7, worth 4 + 5 = 9.

### Example 2

Input: `weights = [5]`, `worths = [10]`, `capacity = 4`

Output: `0`

The only item is too heavy.

### Example 3

Input: `weights = [1, 1]`, `worths = [3, 4]`, `capacity = 1`

Output: `4`

Only one item fits, so take the more valuable one.

## Notes

Taking the items with the best worth-per-weight first is the obvious greedy rule,
and it is wrong: in Example 1 the item of weight 1 has the best ratio and is not
in the answer.
