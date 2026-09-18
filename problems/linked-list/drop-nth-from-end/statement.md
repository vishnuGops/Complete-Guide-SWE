Remove the `n`-th link counting from the end of the chain, and return the head of
what remains. The last link is the 1st from the end.

Do it in a single walk.

## Input

- `head` — the first link of a non-empty chain
- `n` — which link to remove, counting from the end

## Output

The head of the chain with that link removed.

A chain is written as the list of its values, so an empty chain is `[]` as an
input and `null` as a result — there is no link to point at.

## Constraints

- `1 <= number of links <= 10^4`
- `1 <= n <= number of links`
- `-10^9 <= link value <= 10^9`

## Examples

### Example 1

Input: `head = [1, 2, 3, 4, 5]`, `n = 2`

Output: `[1, 2, 3, 5]`

The 2nd from the end is the 4.

### Example 2

Input: `head = [1]`, `n = 1`

Output: `[]`

Removing the only link leaves the empty chain.

### Example 3

Input: `head = [1, 2]`, `n = 2`

Output: `[2]`

The 2nd from the end is the head itself.

## Notes

Example 3 is the case that decides how you write this: the link being removed can
be the head, and then there is nothing in front of it to re-point.
