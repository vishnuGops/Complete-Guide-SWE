Letters were written as numbers: `a` is `1`, `b` is `2`, and so on up to `z`,
which is `26`. The separators have been lost.

Count the ways the digits could be read back as letters.

A number with a leading zero is not a letter, so `06` cannot be read as `f`, and
a `0` on its own cannot be read at all.

## Input

- `digits` — a string of digits

## Output

The number of readings.

## Constraints

- `1 <= digits.length <= 45`
- `digits` contains only the characters `0` to `9`.

## Examples

### Example 1

Input: `digits = "226"`

Output: `3`

`bbf` (2 2 6), `bz` (2 26) and `vf` (22 6).

### Example 2

Input: `digits = "06"`

Output: `0`

A leading zero is not a letter.

### Example 3

Input: `digits = "10"`

Output: `1`

`j` — the `0` must join the `1`.
