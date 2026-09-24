You are given `k` chains, each already in ascending order. Splice them into a
single ascending chain and return its head.

Reuse the links you were given.

A chain is written as the list of its values, so an empty chain is `[]` as an
input and `null` as a result.

## Input

- `chains` — a list of chain heads, each chain in ascending order; individual
  chains may be empty, and the list itself may be empty

## Output

The head of the merged chain.

## Constraints

- `0 <= chains.length <= 10^4`
- `0 <= total links across all chains <= 10^4`
- `-10^9 <= link value <= 10^9`

## Examples

### Example 1

Input: `chains = [[1, 4, 5], [1, 3, 4], [2, 6]]`

Output: `[1, 1, 2, 3, 4, 4, 5, 6]`

### Example 2

Input: `chains = []`

Output: `null`

There is nothing to merge.

### Example 3

Input: `chains = [[], [1], []]`

Output: `[1]`

Empty chains contribute nothing.

## Notes

Merging the chains one at a time into a growing result re-walks everything
already merged, which is `O(k · N)`. At the stated maxima — ten thousand chains
of one link each — that is fifty million link steps: too slow for the time limit
in Python, though Java's JIT gets through it. Either way it misses the
`O(N log k)` target.
