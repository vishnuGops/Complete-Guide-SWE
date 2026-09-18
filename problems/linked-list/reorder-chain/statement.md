Fold a chain onto itself: take the first link, then the last, then the second,
then the second to last, and so on.

A chain `[a, b, c, d, e]` becomes `[a, e, b, d, c]`.

Relink the chain; do not build a new one, and do not simply move the values
around a copy.

A chain is written as the list of its values, so an empty chain is `[]` as an
input and `null` as a result.

## Input

- `head` — the head of a chain, possibly empty

## Output

The head of the folded chain.

## Constraints

- `0 <= number of links <= 10^4`
- `-10^9 <= link value <= 10^9`
- You may use only `O(1)` extra space.

## Examples

### Example 1

Input: `head = [1, 2, 3, 4]`

Output: `[1, 4, 2, 3]`

### Example 2

Input: `head = [1, 2, 3, 4, 5]`

Output: `[1, 5, 2, 4, 3]`

The middle link ends up last, because it has nothing to pair with.

### Example 3

Input: `head = [1]`

Output: `[1]`

A single link is already folded.
