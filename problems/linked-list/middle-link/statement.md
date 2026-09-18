Return the middle link of a chain — that is, the chain that starts at the middle
link and runs to the end.

When the chain has an even number of links there are two middles; return the
second of them.

Do it in a single walk. Counting the links and then walking half of them again
is two walks, and the point of the problem is the trick that avoids the second.

## Input

- `head` — the first link of a non-empty chain

## Output

The middle link, which is the head of the chain from the middle onwards.

## Constraints

- `1 <= number of links <= 10^4`
- `-10^9 <= link value <= 10^9`

## Examples

### Example 1

Input: `head = [1, 2, 3, 4, 5]`

Output: `[3, 4, 5]`

Five links: the third is the middle.

### Example 2

Input: `head = [1, 2, 3, 4, 5, 6]`

Output: `[4, 5, 6]`

Six links: the middles are the third and the fourth, and the second of them is
asked for.

### Example 3

Input: `head = [9]`

Output: `[9]`

A single link is its own middle.
