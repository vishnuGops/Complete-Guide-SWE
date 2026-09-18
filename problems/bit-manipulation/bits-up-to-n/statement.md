For every number from `0` to `n`, report how many of its bits are `1`.

## Input

- `n` — the last number to report on

## Output

A list of `n + 1` numbers: position `i` holds the number of `1` bits in `i`.

## Constraints

- `0 <= n <= 10^5`

## Examples

### Example 1

Input: `n = 5`

Output: `[0, 1, 1, 2, 1, 2]`

0 is `0`, 1 is `1`, 2 is `10`, 3 is `11`, 4 is `100`, 5 is `101`.

### Example 2

Input: `n = 0`

Output: `[0]`

### Example 3

Input: `n = 2`

Output: `[0, 1, 1]`
