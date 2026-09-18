The values may repeat. Report every **distinct** subset.

Two subsets are the same when they hold the same values the same number of
times, whatever the order. So `[1, 2]` from the first and second positions of
`[1, 2, 2]` and `[1, 2]` from the first and third are one subset, not two.

## Input

- `values` — a list of integers, possibly with repeats

## Output

Every distinct subset, as a list of lists.

## Constraints

- `1 <= values.length <= 10`
- `-10 <= values[i] <= 10`

## Examples

### Example 1

Input: `values = [1, 2, 2]`

Output: `[[], [1], [2], [1,2], [2,2], [1,2,2]]`

Six distinct subsets. `[2]` appears once even though either 2 could supply it.

### Example 2

Input: `values = [0]`

Output: `[[], [0]]`

### Example 3

Input: `values = [4, 4, 4]`

Output: `[[], [4], [4,4], [4,4,4]]`

With three equal values the only thing that distinguishes a subset is how many
it takes.
