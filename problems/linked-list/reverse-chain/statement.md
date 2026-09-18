Reverse a chain of links and return the new head.

A chain is written here as the list of its values, head first: `[1, 2, 3]` is a
chain of three links. The empty chain is `[]`.

## Input

- `head` — the first link of the chain, or nothing if the chain is empty

## Output

The first link of the reversed chain.

A chain is written as the list of its values, so an empty chain is `[]` as an
input and `null` as a result — there is no link to point at.

## Constraints

- `0 <= number of links <= 10^4`
- `-10^9 <= link value <= 10^9`
- Use `O(1)` extra space: reverse the links themselves rather than copying their
  values into a list.

## Examples

### Example 1

Input: `head = [1, 2, 3, 4, 5]`

Output: `[5, 4, 3, 2, 1]`

### Example 2

Input: `head = [1, 2]`

Output: `[2, 1]`

### Example 3

Input: `head = []`

Output: `[]`

The empty chain reverses to itself.
