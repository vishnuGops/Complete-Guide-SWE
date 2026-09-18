A maintenance schedule is a list of windows, already sorted by start time and
already merged: no two of them overlap or touch.

Add one more window and return the schedule, still sorted and still merged. Two
windows that share any moment — including one ending exactly where the next
begins — become a single window.

## Input

- `schedule` — a list of `[start, end]` pairs, sorted by start, none overlapping
  or touching
- `added` — the `[start, end]` pair to add

## Output

The schedule with `added` folded in: sorted by start, with no two windows
overlapping or touching.

## Constraints

- `0 <= schedule.length <= 10^4`
- `0 <= start <= end <= 10^9` for every window, `added` included

## Examples

### Example 1

Input: `schedule = [[1, 3], [6, 9]]`, `added = [2, 5]`

Output: `[[1, 5], [6, 9]]`

`[2, 5]` overlaps `[1, 3]`, so they merge into `[1, 5]`. `[6, 9]` is untouched.

### Example 2

Input: `schedule = [[1, 2], [5, 6]]`, `added = [2, 5]`

Output: `[[1, 6]]`

The new window touches both: it starts exactly where the first ends and ends
exactly where the second begins, so all three become one.

### Example 3

Input: `schedule = []`, `added = [4, 8]`

Output: `[[4, 8]]`

An empty schedule gains its first window.
