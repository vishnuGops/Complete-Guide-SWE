# Median Of Two Series

## Approach

The median is defined by a *position* in the combined order, so aim at the cut
rather than at the value.

Cut `first` after `i` readings and `second` after `j`, with `i + j` fixed at
`half = (n + m + 1) / 2` rounded up. That fixes the sizes; what remains is
whether the cut is in the right *place*. It is exactly when nothing on the left
exceeds anything on the right, and because both series are sorted that is just
two comparisons:

```
first[i-1]  <= second[j]     and     second[j-1] <= first[i]
```

with `-infinity` standing in when a left part is empty and `+infinity` when a
right part is empty — which is what removes every boundary special case.

Choosing `i` fixes `j = half - i`, so there is a single unknown, and the failing
comparison says which way to move it:

- `first[i-1] > second[j]` — too many taken from `first`; search lower.
- `second[j-1] > first[i]` — too few; search higher.

When both hold, the left parts hold the smaller half of all the readings. The
median is then `max(first[i-1], second[j-1])` for an odd total, or the average of
that and `min(first[i], second[j])` for an even one — which is why `half` rounds
*up*: it puts the extra reading on the left, where the odd-case answer is.

Two details make the whole thing safe:

- **Search over the shorter series.** Swapping so that `n <= m` keeps `j` inside
  `[0, m]` for every `i` in `[0, n]`; without it `j` can fall out of range.
- **`i` ranges over `[0, n]`, not `[0, n-1]`.** Taking none or all of the shorter
  series is a legal cut, and is the answer whenever the series do not overlap.

## Complexity

- Time: `O(log(min(n, m)))`.
- Space: `O(1)`.

## Pitfalls

- **Searching the longer series.** `j` goes negative or past the end, and the
  sentinels stop protecting you.
- **Rounding `half` down.** The odd case then reads its answer from the right
  parts, and the two branches stop agreeing.
- **Using the middle *values* instead of the middle *positions*.** The average of
  the two medians is not the median of the union.
- **Overflow when averaging.** Two readings at the extremes sum outside a 32-bit
  `int` in the general version of this problem; add as `long` or `double`.
