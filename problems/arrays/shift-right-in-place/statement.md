A row of integers is to be shifted to the right by `shift` positions. Every
element moves `shift` places towards the end, and whatever falls off the end
wraps around to the front.

Rewrite the row **in place**. The judge ignores whatever you return and checks
the contents of `values` after your method finishes, so allocating a second array
of length `n` and returning it will not pass — and neither will reassigning the
parameter to a new list, which leaves the caller's array untouched.

## Input

- `values` — a list of integers, `1 <= values.length <= 10^5`
- `shift` — a non-negative integer, possibly much larger than `values.length`

## Output

Nothing is returned. After the call, `values[(i + shift) % n]` must hold whatever
`values[i]` held before it, where `n` is the length of the row.

## Constraints

- `1 <= values.length <= 10^5`
- `-10^9 <= values[i] <= 10^9`
- `0 <= shift <= 10^9`
- You may use only `O(1)` extra space.

## Examples

### Example 1

Input: `values = [1, 2, 3, 4, 5]`, `shift = 2`
After: `values = [4, 5, 1, 2, 3]`

The last two elements wrap to the front; everything else slides two places right.

### Example 2

Input: `values = [4, 5, 6]`, `shift = 3`
After: `values = [4, 5, 6]`

A shift equal to the length brings every element back where it started.

### Example 3

Input: `values = [-3, -1, 0, 2, 8]`, `shift = 9`
After: `values = [-1, 0, 2, 8, -3]`

Only `9 % 5 == 4` matters. A shift of four is the same as moving the single
leading element to the back.
