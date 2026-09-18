Every reading is graded `0` (low), `1` (normal) or `2` (high). Rearrange the row
so that all the lows come first, then the normals, then the highs.

Change the row you are given. Nothing is returned.

Do it in a single pass. Counting the three grades and then overwriting the row
works, but it reads the row twice; a single pass is possible and is the point of
the problem.

## Input

- `grades` — a list where every value is 0, 1 or 2, changed in place

## Output

Nothing. After the call, `grades` holds its 0s, then its 1s, then its 2s.

## Constraints

- `1 <= grades.length <= 10^4`
- `grades[i]` is `0`, `1` or `2`.
- You may use only `O(1)` extra space.

## Examples

### Example 1

Input: `grades = [2, 0, 2, 1, 1, 0]`

Output: `grades` becomes `[0, 0, 1, 1, 2, 2]`

### Example 2

Input: `grades = [2, 0, 1]`

Output: `grades` becomes `[0, 1, 2]`

### Example 3

Input: `grades = [1, 1, 1]`

Output: `grades` becomes `[1, 1, 1]`

Only one grade is present, so nothing moves.
