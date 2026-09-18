A chain of links runs from a head node, each pointing at the next. Usually the
last one points at nothing - but this one might instead point back at a link it
has already been through, in which case following it never ends.

Say whether the chain loops.

## Input

- `head` - the first link, or nothing at all if the chain is empty

## Output

`true` if following the links never reaches an end, `false` if it does.

## Constraints

- The chain has at most `10^4` links.
- A link's value is between `-1000` and `1000`, and values may repeat.
- Extra space must be constant: `O(1)`.

## Examples

### Example 1

Input: `head = [3, 2, 0, -4]`, with the last link pointing back at the second

Output: `true`

Following the chain reaches `-4`, goes back to `2`, and goes round for ever.

### Example 2

Input: `head = [1, 2]`, with the last link pointing back at the first

Output: `true`

The smallest loop worth its own example, because it is the one an off-by-one in
a two-pointer walk gets wrong.

### Example 3

Input: `head = [1, 2, 3]`, ending properly

Output: `false`

### Example 4

Input: `head = [7]`, with the only link pointing at itself

Output: `true`

One link is enough for a loop.

### Example 5

Input: `head = []`

Output: `false`

An empty chain cannot loop.
