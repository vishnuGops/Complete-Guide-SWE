Rearrange a chain so that every link whose value is below `pivot` comes before
every link whose value is `pivot` or above.

Within each of the two groups the links must keep the order they already had.

A chain is written as the list of its values, so an empty chain is `[]` as an
input and `null` as a result.

## Input

- `head` — the head of a chain, possibly empty
- `pivot` — the value to split around

## Output

The head of the rearranged chain.

## Constraints

- `0 <= number of links <= 10^4`
- `-10^9 <= link value <= 10^9`
- `-10^9 <= pivot <= 10^9`

## Examples

### Example 1

Input: `head = [1, 4, 3, 2, 5, 2]`, `pivot = 3`

Output: `[1, 2, 2, 4, 3, 5]`

Below 3: 1, 2, 2 — in the order they appeared. At or above 3: 4, 3, 5, likewise.

### Example 2

Input: `head = [2, 1]`, `pivot = 2`

Output: `[1, 2]`

1 is below the pivot; 2 is not.

### Example 3

Input: `head = [5, 5, 5]`, `pivot = 1`

Output: `[5, 5, 5]`

Nothing is below the pivot, so nothing moves.
