Report whether a chain reads the same forwards and backwards.

Use `O(1)` extra space. Copying the values into a list and comparing it with its
reverse is `O(n)` space, and the constraint rules it out.

## Input

- `head` — the head of a chain, possibly empty

## Output

`true` if the chain reads the same in both directions, `false` otherwise.

## Constraints

- `0 <= number of links <= 10^4`
- `-10^9 <= link value <= 10^9`
- You may use only `O(1)` extra space.

## Examples

### Example 1

Input: `head = [1, 2, 2, 1]`

Output: `true`

### Example 2

Input: `head = [1, 2]`

Output: `false`

### Example 3

Input: `head = []`

Output: `true`

An empty chain reads the same in both directions.
