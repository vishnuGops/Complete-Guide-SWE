# Largest Run Sum

## Approach

The trick is to ask a smaller question: what is the best run that _ends at minute
`i`_? There are only two candidates. Either it is the best run ending at `i - 1`
with `values[i]` appended, or it is `values[i]` alone — because any longer run
ending at `i` contains a run ending at `i - 1`, and if that one had a negative
total it was worth dropping.

So `best_here = max(values[i], best_here + values[i])`, carried along in one
pass, and the answer is the largest `best_here` ever seen. Two numbers, one
sweep, nothing stored.

The invariant is worth saying out loud, because it is what makes the answer
correct rather than plausible: after processing minute `i`, `best_here` is the
largest sum of any run ending exactly at `i`, and `best` is the largest sum of
any run ending at or before `i`.

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- **Starting the running total at zero.** That silently allows the empty run, so
  a row of all-negative values answers `0` instead of the least negative value.
  Start both numbers at `values[0]`.
- **Summing every slice.** Two nested loops with a running sum is `O(n^2)`; at
  the stated maximum that is fifty million additions, which Python does not
  finish inside the time limit. Java's JIT gets through it, so there the target complexity is the bar rather than the clock.
- **Resetting on any negative value.** The rule is to drop the _running total_
  when it goes negative, not to drop negative values: `[4, -1, 2]` is a better
  run than either `[4]` or `[2]`.
