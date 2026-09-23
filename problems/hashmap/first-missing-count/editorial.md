# The Smallest Missing Count

## Approach

The key observation is about the _range_ of the answer, not about the values.
With `n` counts in hand, the values `1 .. n + 1` are `n + 1` candidates and only
`n` of them can be present, so the answer is always in `1 .. n + 1`. Everything
outside that range — negatives, zeroes, anything above `n` — cannot be the
answer and cannot rule one out.

That makes the row itself a big enough table. Put each in-range value `v` at
position `v - 1`, and the answer is the first position `i` whose value is not
`i + 1`; if every position is right, the answer is `n + 1`.

The placement is done by swapping:

```
for i in 0 .. n-1:
    while counts[i] is in 1..n and counts[counts[i] - 1] != counts[i]:
        swap counts[i] with counts[counts[i] - 1]
```

The inner loop looks alarming, but each swap sends a value to its final home and
no value is ever moved out of one, so there are at most `n` swaps across the
whole run — amortised `O(n)`.

The condition to swap on is `counts[counts[i] - 1] != counts[i]`, not
`counts[i] != i + 1`. The difference is duplicates: with two 3s the second one
has nowhere to go, and comparing against the _destination_ stops immediately
instead of swapping forever.

A hash set of the in-range values is the same algorithm with the table made
explicit — `O(n)` time, `O(n)` space, and worth writing first if the in-place
version is not yet obvious.

## Complexity

- Time: `O(n)`, amortised over the swaps.
- Space: `O(1)`, using the row as the table.

## Pitfalls

- **Scanning for each candidate.** `for candidate in 1..n+1: if candidate in
counts` is `O(n^2)` and does not finish at the stated maximum.
- **Sorting first.** `O(n log n)` and correct, but it gives up the linear target
  and still needs care with duplicates and junk.
- **Looping forever on duplicates.** Swapping while `counts[i] != i + 1` never
  terminates when the destination already holds the same value.
- **Forgetting `n + 1`.** A complete row `1 .. n` has no gap inside it, and the
  answer is the value one past the end.
