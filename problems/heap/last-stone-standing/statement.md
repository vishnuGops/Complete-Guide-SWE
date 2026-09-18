A pile of stones is smashed together, two at a time. Each round takes the **two
heaviest** stones and smashes them:

- if they weigh the same, both are destroyed;
- otherwise the lighter is destroyed and the heavier is left weighing the
  difference.

Repeat until at most one stone remains. Report the weight of the stone left, or
`0` if none is.

## Input

- `stones` — the stones' weights

## Output

The weight of the last stone, or `0`.

## Constraints

- `1 <= stones.length <= 10^4`
- `1 <= stones[i] <= 1000`

## Examples

### Example 1

Input: `stones = [2, 7, 4, 1, 8, 1]`

Output: `1`

8 and 7 leave a 1; then 4 and 2 leave a 2; then 2 and 1 leave a 1; then 1 and 1
destroy each other; one stone of weight 1 is left.

### Example 2

Input: `stones = [1, 1]`

Output: `0`

Equal stones destroy each other.

### Example 3

Input: `stones = [5]`

Output: `5`

Nothing to smash it with.
