# The K Closest Readings

## Approach

Everything follows from one claim: **the answer is a contiguous run of
`readings`.** Suppose it were not — that `readings[i]` and `readings[j]` are
both chosen with `i < m < j` and `readings[m]` left out. Because the row is
sorted, `readings[m]` lies between them, so it is no further from the target
than whichever of the two is further. Swapping it in cannot make the answer
worse, and with the tie rule it cannot make it different. So a contiguous run is
always available.

That reduces the problem to choosing a left end `left` in `0 .. n - k`. Compare
the run starting at `left` with the run starting at `left + 1`: they differ by
dropping `readings[left]` and gaining `readings[left + k]`. The later run is
better exactly when

```
target - readings[left] > readings[left + k] - target
```

— that is, when the reading being dropped is strictly further away than the one
being gained. (Written as differences rather than absolute values on purpose:
the form above is correct even when the target lies outside the row, and it
avoids the sign case-analysis `abs` would need.)

That predicate is monotone in `left`, so binary search over the left end finds
the first position where it stops holding. `O(log n)` to find the run, `O(k)` to
copy it out.

The heap answer — push all `n` readings keyed by distance and pop `k` — is
`O(n log n)` and ignores the sortedness. The two-pointer answer — start with the
whole row and shrink from whichever end is further until `k` remain — is `O(n)`
and is a good middle step. The binary search is the one that uses everything the
problem gives you.

## Complexity

- Time: `O(log n + k)`.
- Space: `O(k)` for the output.

## Pitfalls

- **Comparing with `abs`.** `abs(target - readings[left]) > abs(readings[left+k]
  - target)` gets the tie wrong when the target is below the whole row: both
    sides are distances and the tie must go to the smaller reading.
- **Searching over `0 .. n`.** The left end cannot exceed `n - k`, or the run
  runs off the end.
- **Sorting by distance.** It discards the ordering the answer has to be
  returned in, and the tie rule has to be re-imposed by hand.
