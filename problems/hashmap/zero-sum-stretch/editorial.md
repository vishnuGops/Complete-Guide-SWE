# Stretch That Cancels Out

## Approach

Let `total[i]` be the sum of the first `i` changes, with `total[0] = 0`. The sum
of the stretch from minute `i` to minute `j - 1` is `total[j] - total[i]`, so

> **the stretch cancels out exactly when `total[i] == total[j]`.**

That reframes the whole problem. It is no longer about stretches at all: it is
about how many pairs of moments share a running total. If a particular total
occurs `c` times among the `n + 1` moments, it contributes `c · (c - 1) / 2`
cancelling stretches.

Counting the pairs as you go is simpler than counting them at the end. Walk the
changes keeping the running total and a map from total to how many times it has
been seen. At each moment, the number of cancelling stretches _ending here_ is
exactly the count already recorded for the current total; add it to the answer,
then record this moment.

The seed matters: the map starts with `{0: 1}`, standing for the moment before
the first minute. Without it, every stretch that starts at the beginning is
missed — and the easiest way to notice is that `[0]` would answer 0 instead of 1.

## Complexity

- Time: `O(n)`.
- Space: `O(n)` for the map, which in the worst case holds a distinct total for
  every moment.

## Pitfalls

- **Summing every stretch.** `O(n^2)`; at the stated maximum that is fifty
  million additions, which Python does not finish inside the time limit.
  Java's JIT gets through it, so there the target complexity is the bar rather than the clock.
- **Forgetting the seed.** `{0: 1}` is the moment before the first change, and
  without it the answer is wrong on every input whose first minutes cancel.
- **Counting after the fact with `c · (c-1) / 2`.** Also correct, but it is an
  extra pass, and the running form makes the invariant easier to state.
- **Assuming the answer fits in a smaller type by accident.** Ten thousand
  zeroes give about fifty million stretches; that fits in a 32-bit integer, but
  only just, and it is worth knowing why.
