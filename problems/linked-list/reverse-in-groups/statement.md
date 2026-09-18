Reverse the chain in groups of `k`: the first `k` links, then the next `k`, and
so on.

If fewer than `k` links remain at the end, leave them exactly as they are.

A chain is written as the list of its values, so an empty chain is `[]` as an
input and `null` as a result.

## Input

- `head` — the head of a chain, possibly empty
- `k` — the group size

## Output

The head of the chain with each complete group of `k` reversed.

## Constraints

- `0 <= number of links <= 10^4`
- `1 <= k <= 10^4`
- `-10^9 <= link value <= 10^9`
- You may use only `O(1)` extra space.

## Examples

### Example 1

Input: `head = [1, 2, 3, 4, 5]`, `k = 2`

Output: `[2, 1, 4, 3, 5]`

Two complete groups are reversed; the lone 5 stays where it is.

### Example 2

Input: `head = [1, 2, 3, 4, 5]`, `k = 3`

Output: `[3, 2, 1, 4, 5]`

One complete group; the remaining two links are fewer than `k`.

### Example 3

Input: `head = [1, 2, 3]`, `k = 1`

Output: `[1, 2, 3]`

Groups of one reverse to themselves.
