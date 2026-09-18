Two chains are each already in ascending order. Splice them into one chain, still
in ascending order, and return its head.

Reuse the links you were given; do not build new ones.

## Input

- `first` — the head of an ascending chain, possibly empty
- `second` — the head of an ascending chain, possibly empty

## Output

The head of the merged chain.

A chain is written as the list of its values, so an empty chain is `[]` as an
input and `null` as a result — there is no link to point at.

## Constraints

- `0 <= links in each chain <= 10^4`
- `-10^9 <= link value <= 10^9`
- Both chains are in ascending order and may contain duplicates.

## Examples

### Example 1

Input: `first = [1, 2, 4]`, `second = [1, 3, 4]`

Output: `[1, 1, 2, 3, 4, 4]`

### Example 2

Input: `first = []`, `second = [0]`

Output: `[0]`

An empty chain contributes nothing.

### Example 3

Input: `first = []`, `second = []`

Output: `[]`

Two empty chains merge to an empty chain.
