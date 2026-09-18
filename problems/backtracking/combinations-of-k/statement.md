Report every way to choose `k` of the numbers `1` to `n`.

Neither the order of the choices nor the order within a choice matters — `[1, 2]`
and `[2, 1]` are the same choice and should appear once.

## Input

- `n` — the numbers are `1` to `n`
- `k` — how many to choose

## Output

Every choice of `k` numbers, as a list of lists.

## Constraints

- `1 <= n <= 14`
- `0 <= k <= n`

## Examples

### Example 1

Input: `n = 4`, `k = 2`

Output: `[[1,2], [1,3], [1,4], [2,3], [2,4], [3,4]]`

Six choices, in any order.

### Example 2

Input: `n = 3`, `k = 0`

Output: `[[]]`

There is exactly one way to choose nothing: the empty choice.

### Example 3

Input: `n = 3`, `k = 3`

Output: `[[1,2,3]]`

Only one way to take everything.
