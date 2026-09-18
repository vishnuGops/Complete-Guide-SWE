# Dot Product Of Sparse Readings

## Approach

Two decisions, and they are separable.

**What to store.** Only the non-zero entries. Either a map from position to
value, or a list of `(position, value)` pairs sorted by position. Both are
`O(k)` where `k` is the number of readings actually present, which is the whole
point: a row of ten thousand slots with six readings costs six entries.

**How to multiply.** A position contributes to the dot product only if it is
non-zero in *both* rows, so the work is proportional to the overlap, not to the
rows' length.

- With maps: walk the *smaller* map and look each position up in the larger. The
  cost is `O(min(k1, k2))`. Walking the larger one works too and is needlessly
  slower.
- With sorted pair lists: two pointers, one per row. Whichever position is
  behind moves forward; when the two positions match, multiply and advance both.
  The cost is `O(k1 + k2)`, with no hashing at all.

The two-pointer version is the one worth knowing, because it is the same merge
that underlies sorted-list intersection and k-way merging, and because it keeps
its advantage when the rows are stored on disk in position order.

Unknown names need no special case if a missing row is read as an empty one: an
empty overlap sums to zero, which is the right answer.

## Complexity

- Time: `O(k1 + k2)` per dot product; `O(n)` for an `add`, which has to look at
  every slot once to find the non-zero ones.
- Space: `O(k)` per stored row.

## Pitfalls

- **Storing the dense row anyway.** It makes `add` cheap and `dot` `O(n)`, which
  is exactly the cost the problem is about.
- **Walking the larger map.** Correct, but it throws away the `min(k1, k2)`
  bound that motivates the design.
- **Keeping stored zeroes.** A value of zero contributes nothing to any product
  and makes `nonZeroCount` wrong.
- **Forgetting that `add` replaces.** A second `add` under the same name must
  not merge with the first.
