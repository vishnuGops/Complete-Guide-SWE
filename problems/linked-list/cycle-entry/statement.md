A chain of links may loop: somewhere along it, a link points back at one it has
already been through. Every link from that point on is part of the loop, and the
links before it are the run-up.

Say how far along the chain the loop begins - the position of the first link that
is part of it, counting the head as `0`.

## Input

- `head` - the first link, or nothing at all if the chain is empty

## Output

The position of the link the loop begins at, or `-1` if the chain does not loop.
An empty chain does not loop.

## Constraints

- The chain has at most `10^4` links.
- A link's value is between `-1000` and `1000`, and values may repeat.
- Extra space must be constant: `O(1)`.

## Examples

### Example 1

Input: `head = [8, -5, 6, 1, 9]`, with the last link pointing back at the third

Output: `2`

The run-up is two links long, so the loop begins at position `2`.

### Example 2

Input: `head = [1, 2]`, with the last link pointing back at the first

Output: `0`

The whole chain is the loop, so it begins at the head.

### Example 3

Input: `head = [1, 2, 3]`, ending properly

Output: `-1`

### Example 4

Input: `head = [7]`, with the only link pointing at itself

Output: `0`
