A configuration language uses three kinds of brackets: `()`, `[]` and `{}`. A
fragment is balanced when every opening bracket is closed by one of the same kind,
and brackets close in the reverse of the order they opened - so `([])` is
balanced and `([)]` is not.

Return whether the fragment is balanced.

## Input

- `text` - a string containing only the characters `(`, `)`, `[`, `]`, `{` and `}`

## Output

`true` if the fragment is balanced, `false` otherwise.

## Constraints

- `0 <= text.length <= 10000`
- `text` contains only the six bracket characters
- The empty fragment is balanced.

## Examples

### Example 1

Input: `text = "([]{})"`
Output: `true`

Every bracket closes in the reverse order it opened.

### Example 2

Input: `text = "(]"`
Output: `false`

The round bracket is closed by a square one.

### Example 3

Input: `text = ""`
Output: `true`

Nothing is open, so nothing is left unclosed.
