# Fit One More Window

## Approach

The schedule being sorted _and_ merged is the whole gift. It means the windows
that can possibly meet the new one form a single unbroken run: everything before
that run ends strictly before the new window starts, and everything after it
starts strictly after the new window ends. So one pass in three phases:

1. **Before.** While `schedule[i].end < added.start`, copy the window through.
2. **Meeting.** While `schedule[i].start <= added.end`, widen the new window:
   `start = min(start, schedule[i].start)`, `end = max(end, schedule[i].end)`.
   Then append the widened window once.
3. **After.** Copy the remaining windows through.

The comparisons are what encode "touching counts as overlapping": `end < start`
in phase 1 (so `end == start` falls into phase 2), and `start <= end` in phase 2.
Flip either to its strict or non-strict twin and Example 2 breaks.

The alternative — append the new window, sort, then merge the whole list — is
correct and is `O(n log n)`. It throws away the sortedness the problem handed
you, which is the thing worth noticing.

## Complexity

- Time: `O(n)`, one pass.
- Space: `O(n)` for the output.

## Pitfalls

- **Appending the widened window inside the loop.** It has to go in once, after
  the run of merges is finished, or a run of three merged windows produces three
  outputs.
- **Getting the touching rule backwards.** `[1,2]` and `[2,5]` merge here.
- **Forgetting the empty schedule**, and the case where the new window lands
  after every existing one, which is phase 2 and phase 3 both doing nothing.
- **Assuming the new window is wider than what it absorbs.** `[[1, 9]]` with
  `added = [3, 4]` merges to `[[1, 9]]`; taking the new window's own bounds
  loses the rest.
