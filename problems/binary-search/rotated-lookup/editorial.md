## Approach

Binary search needs a way to discard half the range. A rotated series is not
sorted, so the usual comparison does not decide anything on its own - but one
fact rescues it: **cut anywhere and at least one half is still sorted**, because
the rotation point can only fall in one of them.

So each step has two questions instead of one. First, which half is sorted?
Comparing `values[low]` with `values[mid]` answers it. Second, does the target lie
within that sorted half's range? If it does, search there; if not, the answer can
only be in the other half.

Distinctness is what keeps this clean. With duplicates, `values[low] == values[mid]`
tells you nothing about which side is sorted, and the worst case degrades to a
linear scan.

## Complexity

- Time: `O(log n)`.
- Space: `O(1)`.

## Pitfalls

- Testing the target against the sorted half with the wrong strictness: the
  boundary reading belongs to that half, so `values[low] <= target < values[mid]`
  is the correct shape.
- Deciding which half is sorted with `<` rather than `<=` breaks the two-element
  case, where `low` and `mid` are the same index.
- Forgetting the empty series, which has no index to return.
