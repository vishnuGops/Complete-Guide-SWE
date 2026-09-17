## Approach

This is the boundary form of binary search rather than the find-me-this-value
form, and it is worth learning as its own shape: everything before the answer
fails the test `values[i] >= threshold` and everything from the answer onwards
passes it.

Keep a half-open range `[low, high)` that is guaranteed to contain the answer.
Starting with `high = n` rather than `n - 1` is what makes "no reading qualifies"
come out as `n` with no special case.

At each step look at `mid`. If it passes the test, the answer is `mid` or earlier,
so `high = mid` - note `mid`, not `mid - 1`, because `mid` is still a candidate.
If it fails, the answer is after it, so `low = mid + 1`. The range shrinks every
step, and when it is empty `low` is the boundary.

## Complexity

- Time: `O(log n)`.
- Space: `O(1)`.

## Pitfalls

- `high = mid - 1` discards the candidate the search just found and returns an
  index one too far.
- Starting with `high = n - 1` cannot represent "not found" and reports the last
  index instead.
- `(low + high) / 2` overflows in Java for large indices; `low + (high - low) / 2`
  does not.
- Stopping early when `values[mid] == threshold` returns some matching index
  rather than the first one.
