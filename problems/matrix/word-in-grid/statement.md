A grid of letters may spell a word along a path that steps between cells sharing
an edge — up, down, left or right. No cell may be used twice in the same path.

Report whether the word can be spelled.

## Input

- `board` — a rectangular grid of single lowercase letters
- `word` — the word to look for

## Output

`true` if the word can be spelled along such a path, `false` otherwise.

## Constraints

- `1 <= board.length <= 6`
- `1 <= board[0].length <= 6`
- Every row has the same length.
- `1 <= word.length <= 15`
- Every cell and every character of `word` is a lowercase English letter.

## Examples

### Example 1

Input: `board = [["a", "b"], ["c", "d"]]`, `word = "abdc"`

Output: `true`

Right, down, left.

### Example 2

Input: `board = [["a", "b"], ["c", "d"]]`, `word = "abad"`

Output: `false`

The path would have to use the `a` twice.

### Example 3

Input: `board = [["a"]]`, `word = "a"`

Output: `true`

## Notes

The search is exponential in the length of the word, and the grid is small
precisely because of that. A board of one repeated letter with a word that almost
matches is the case that separates a pruned search from an unpruned one.
