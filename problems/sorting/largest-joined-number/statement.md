Write the given non-negative numbers one after another, in whatever order you
like, to form a single long number. Return the largest such number you can make.

The answer is returned as a string, because it can be far longer than any
integer type holds. If every number is zero, the answer is `"0"` — not a run of
zeroes.

## Input

- `parts` — a list of non-negative integers

## Output

The largest number that can be formed by joining every element of `parts`, as a
string with no leading zeroes.

## Constraints

- `1 <= parts.length <= 200`
- `0 <= parts[i] <= 10^9`

## Examples

### Example 1

Input: `parts = [10, 2]`

Output: `"210"`

`"210"` beats `"102"`.

### Example 2

Input: `parts = [3, 30, 34, 5, 9]`

Output: `"9534330"`

The order is 9, 5, 34, 3, 30. Sorting the parts as numbers would put 34 before
30 before 5, and `"3430953"` is much smaller. What decides each pair is the
joining: `"343"` beats `"334"`, so 34 goes first, and `"330"` beats `"303"`, so
3 goes before 30.

### Example 3

Input: `parts = [0, 0]`

Output: `"0"`

Two zeroes make zero, written once.
