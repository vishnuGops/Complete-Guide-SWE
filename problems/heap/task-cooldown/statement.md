A machine runs one task per tick. Each task is named by a letter, and after
running a task the machine may not run **that same task** again for `cooldown`
ticks — though it may run any other task, or stand idle.

Given the tasks to run, in any order you like, report the fewest ticks needed to
run them all.

## Input

- `tasks` — a string of lowercase letters, one per task to run
- `cooldown` — how many ticks must pass before the same task may run again

## Output

The fewest ticks needed, counting idle ticks.

## Constraints

- `1 <= tasks.length <= 10^4`
- `0 <= cooldown <= 10^4`
- `tasks` contains only lowercase English letters.

## Examples

### Example 1

Input: `tasks = "aabb"`, `cooldown = 2`

Output: `5`

`a b _ a b`. The two `a`s are three ticks apart and so are the two `b`s, which is
the closest the cooldown allows, and one tick is spent idle.

### Example 2

Input: `tasks = "abc"`, `cooldown = 5`

Output: `3`

All three tasks differ, so nothing ever waits.

### Example 3

Input: `tasks = "aaa"`, `cooldown = 2`

Output: `7`

`a _ _ a _ _ a`.

## Notes

Simulating tick by tick is `O(total ticks)`, and the total can reach about
`10^8` at the stated maxima — one task repeated ten thousand times with a
cooldown of ten thousand. That will not finish.
