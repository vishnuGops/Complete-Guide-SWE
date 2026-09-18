A number is stored as a chain of its decimal digits, **least significant digit
first**: the number 342 is the chain `[2, 4, 3]`.

Add two such numbers and return their sum in the same form.

## Input

- `first` — a non-empty chain of digits, least significant first
- `second` — a non-empty chain of digits, least significant first

## Output

The sum, as a chain of digits, least significant first.

## Constraints

- `1 <= digits in each chain <= 10^4`
- `0 <= digit <= 9`
- Neither number has a leading zero — that is, the *last* link of each chain is
  not `0` unless the chain is exactly `[0]`.

## Examples

### Example 1

Input: `first = [2, 4, 3]`, `second = [5, 6, 4]`

Output: `[7, 0, 8]`

342 + 465 = 807.

### Example 2

Input: `first = [0]`, `second = [0]`

Output: `[0]`

Zero plus zero.

### Example 3

Input: `first = [9, 9]`, `second = [1]`

Output: `[0, 0, 1]`

99 + 1 = 100, and the answer is one digit longer than either input.
