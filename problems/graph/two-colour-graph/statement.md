`n` people are numbered `0` to `n - 1`, and each listed pair dislikes each other.

Report whether the people can be split into two rooms so that nobody shares a
room with somebody they dislike. Either room may be empty.

## Input

- `n` — how many people there are
- `dislikes` — a list of `[a, b]` pairs

## Output

`true` if such a split exists, `false` otherwise.

## Constraints

- `1 <= n <= 10^4`
- `0 <= dislikes.length <= 2 · 10^4`
- `0 <= a, b < n`, `a != b`, and no pair is repeated.

## Examples

### Example 1

Input: `n = 4`, `dislikes = [[0, 1], [1, 2], [2, 3], [3, 0]]`

Output: `true`

`{0, 2}` in one room and `{1, 3}` in the other.

### Example 2

Input: `n = 3`, `dislikes = [[0, 1], [1, 2], [2, 0]]`

Output: `false`

Three people who all dislike each other need three rooms.

### Example 3

Input: `n = 5`, `dislikes = []`

Output: `true`

Nobody dislikes anybody, so one room holds everyone.
