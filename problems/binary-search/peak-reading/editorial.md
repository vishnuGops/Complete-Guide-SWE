# A Local Peak

## Approach

Binary search does not need a sorted row. It needs a question whose answer rules
out half the remaining candidates, and the climb log's shape provides one:

> Is `readings[mid] < readings[mid + 1]`?

- **Yes** — the row is still rising at `mid`, so `mid` is not the peak and
  neither is anything to its left (everything left of a rising position is also
  rising). The peak is in `[mid + 1, high]`.
- **No** — the row is falling from `mid` to `mid + 1`, so the peak is at `mid` or
  to its left. The peak is in `[low, mid]`.

The invariant is _the peak is always inside `[low, high]`_, and each step halves
the range without ever excluding it. When `low == high` the range holds one
position, which must therefore be the peak. There is no "found it" test and no
case where the loop can fail to terminate: `mid` is rounded down, so `low` always
moves forward in the first branch and `high` always moves back in the second.

`mid + 1` is always a valid index while `low < high`, because `mid` is then
strictly less than `high`, which is at most `n - 1`.

The same skeleton answers the general "find any local peak in a row with no equal
neighbours" — the guarantee of a single turning point is what makes the answer
unique here, not what makes the search work.

## Complexity

- Time: `O(log n)`.
- Space: `O(1)`.

## Pitfalls

- **Comparing against both neighbours.** It looks more careful and it is not:
  the one-sided comparison already decides the half, and `mid - 1` needs a bounds
  check that `mid + 1` does not.
- **`high = mid - 1`.** `mid` is still a candidate when the row is falling there;
  excluding it loses the answer when the peak is at `mid`.
- **Returning the value instead of the position.** The answer is an index.
- **Assuming a sorted row is required.** It is not, and that is the lesson.
