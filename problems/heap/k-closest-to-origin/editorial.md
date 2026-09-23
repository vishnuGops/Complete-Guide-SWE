# The K Nearest Points

## Approach

**Drop the square root first.** `sqrt` is increasing, so `sqrt(a) < sqrt(b)`
exactly when `a < b`; comparing `x² + y²` gives the same ordering and stays in
exact integer arithmetic, where two points that are genuinely equidistant compare
equal rather than differing in the last bit of a double. At the stated bounds
`x² + y²` reaches `2 · 10^8`, comfortably inside a 32-bit integer.

What remains is a top-k question, and there are three standard answers:

- **Sort** all the points by the ordering rule and take the first `k`.
  `O(n log n)`, and the right first answer.
- **A max-heap of size `k`**, keyed by the ordering rule. Each point is compared
  against the worst point kept; if it is better, it replaces it. `O(n log k)`
  time, `O(k)` space, and it never needs all the points in memory at once —
  which is the reason to prefer it.
- **Quickselect** around the `k`-th smallest squared distance. `O(n)` on average,
  `O(n^2)` in the worst case, and it needs the whole array.

The tie rule matters for the same reason as in `k-most-frequent`: without it,
which of two equidistant points is reported depends on the order the heap
happened to pop, which is not defined. Comparing `(distance², x, y)` gives one
answer everywhere.

## Complexity

- Time: `O(n log k)`.
- Space: `O(k)`.

## Pitfalls

- **Taking the square root.** Slower, and it makes two equal distances compare
  unequal in floating point.
- **A min-heap of all `n` points, popping `k`.** Correct, `O(n + k log n)`, and
  it holds everything.
- **Comparing the wrong way round in the heap.** The heap of the `k` best must
  give up its _worst_ element, so it is ordered opposite to the answer.
- **Forgetting the tie rule.**
