A batch of counts has been recorded, in no particular order, with duplicates and
junk among them. Find the smallest **positive** count that is missing.

Positive means 1 or more, so the answer is at least 1. Zero and negative values
are junk and can only push the answer up by being absent.

You may rearrange `counts` in place.

## Input

- `counts` — a list of integers, in any order

## Output

The smallest positive integer that does not appear in `counts`.

## Constraints

- `1 <= counts.length <= 10^4`
- `-10^9 <= counts[i] <= 10^9`
- Aim for `O(1)` extra space; rearranging `counts` itself is allowed and does not
  count against you.

## Examples

### Example 1

Input: `counts = [3, 4, -1, 1]`

Output: `2`

1 is present, 2 is not.

### Example 2

Input: `counts = [1, 2, 3]`

Output: `4`

Nothing is missing below 4, so the answer is one past the end.

### Example 3

Input: `counts = [7, 8, 9]`

Output: `1`

Large values do not help; the smallest positive integer is missing.

## Notes

Testing each candidate against the whole row is `O(n^2)`. At the stated maximum
that is a hundred million comparisons and it will not finish here.
