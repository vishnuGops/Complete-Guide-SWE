A sensor logs integer readings in the order they arrive. Before charting them,
the tool wants every even reading moved ahead of every odd one — but readings
that are both even must stay in the order they arrived, and so must readings
that are both odd.

Rearrange the readings **in place**. The judge ignores whatever you return and
checks the contents of `values` after your method finishes, so building a new
list and returning it will not pass, and neither will rebinding the parameter to
a fresh list, which leaves the caller's list untouched.

Zero is even. Negative readings follow the same rule as positive ones: `-4` is
even, `-7` is odd.

## Input

- `values` — a list of integers, in the order they were recorded

## Output

Nothing is returned. After the call, `values` holds every even reading first, in
their original relative order, followed by every odd reading, in theirs.

## Constraints

- `0 <= values.length <= 5000`
- `-10^9 <= values[i] <= 10^9`
- An empty list is legal and stays empty.

## Examples

### Example 1

Input: `values = [3, 1, 4, 6, 7]`
After: `values = [4, 6, 3, 1, 7]`

The evens `4` and `6` keep the order they arrived in, and the odds `3`, `1` and
`7` keep theirs.

### Example 2

Input: `values = [-5, -2, 0, 7]`
After: `values = [-2, 0, -5, 7]`

`-2` and `0` are both even, so they lead; `-5` came before `7` and still does.

### Example 3

Input: `values = [1, 3, 5]`
After: `values = [1, 3, 5]`

There is nothing to move when every reading is odd.
