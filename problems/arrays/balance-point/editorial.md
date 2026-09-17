## Approach

Read literally, the problem asks for two sums per index, which is `O(n^2)` and
recomputes almost the same numbers every time.

One observation removes the inner loop: the total of the whole row is fixed. If
`left` is the sum of everything before index `i`, then everything after it must
be `total - left - values[i]`. Both sides are now available in constant time, so
a single pass answers the question.

Returning at the first match is what makes the answer the smallest index.

## Complexity

- Time: `O(n)` - one pass for the total, one to scan.
- Space: `O(1)`.

## Pitfalls

- The pivot belongs to neither side. Comparing `left` with `total - left` forgets
  to remove `values[i]` and quietly answers a different question.
- `left` must be updated **after** the comparison, not before.
- An empty row has no index to return, so the answer is `-1` rather than `0`.
