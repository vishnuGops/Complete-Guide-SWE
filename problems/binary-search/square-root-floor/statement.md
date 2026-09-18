Report the whole square root of `value`: the largest integer `r` with
`r · r <= value`.

Do it with integer arithmetic only. A floating-point square root is close but
not exact, and at the top of the stated range it is off by one often enough to
matter.

## Input

- `value` — a non-negative integer

## Output

The largest integer `r` such that `r * r <= value`.

## Constraints

- `0 <= value <= 2147483647`

## Examples

### Example 1

Input: `value = 16`

Output: `4`

16 is a perfect square.

### Example 2

Input: `value = 24`

Output: `4`

`4 · 4 = 16` fits and `5 · 5 = 25` does not, so the answer is rounded down.

### Example 3

Input: `value = 0`

Output: `0`

Zero's whole square root is zero.
