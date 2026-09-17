## Approach

The requirement that each group keeps its internal order is what decides the
solution. A two-pointer swap from both ends partitions in `O(1)` space, but it
reorders each group as it goes, so it answers a different question.

Reading the list twice gives the stable answer directly. The first pass collects
every even reading in the order it appears; the second collects every odd one.
Concatenating them puts the groups in the required order, and each group is in
arrival order because that is the order the pass visited them.

The only thing left is to get the result back into the caller's list. This is an
in-place problem: the judge looks at `values` after the call, so the result has
to be written over it rather than returned.

## Complexity

- Time: `O(n)` — two passes and one write-back.
- Space: `O(n)` for the two collections.

## Pitfalls

- Rebinding the parameter (`values = evens + odds` in Python, `values = result`
  in Java) changes a local name and nothing else. The caller still sees the
  original list.
- A two-pointer swap is tempting and faster on memory, but it is not stable: on
  `[3, 1, 4, 6, 7]` it produces `[6, 4, ...]` and fails the order requirement.
- `-7 % 2` is `1` in Python but `-1` in Java. Test for even with `v % 2 == 0`,
  which is true in both, rather than testing for odd with `v % 2 == 1`.
