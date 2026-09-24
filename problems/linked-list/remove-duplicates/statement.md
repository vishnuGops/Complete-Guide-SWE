A chain is in ascending order. Remove **every** link whose value appears more
than once, keeping only the values that occur exactly once, and return the head
of what remains.

Note that repeated values are removed entirely, not collapsed to one copy.

## Input

- `head` — the head of an ascending chain, possibly empty

## Output

The head of the chain holding only the values that appeared exactly once, in
their original order.

A chain is written as the list of its values, so an empty chain is `[]` as an
input and `null` as a result — there is no link to point at.

## Constraints

- `0 <= number of links <= 10^4`
- `-10^9 <= link value <= 10^9`
- The chain is in ascending order, so equal values are adjacent.

## Examples

### Example 1

Input: `head = [1, 2, 3, 3, 4, 4, 5]`

Output: `[1, 2, 5]`

Both 3s and both 4s are removed.

### Example 2

Input: `head = [1, 1, 1, 2, 3]`

Output: `[2, 3]`

All three 1s go, including the head.

### Example 3

Input: `head = [1, 1]`

Output: `null`

Every value repeats, so nothing is left.

## Notes

Examples 2 and 3 are the reason this problem is not a one-liner: the head itself
can be removed, and so can every link in the chain.
