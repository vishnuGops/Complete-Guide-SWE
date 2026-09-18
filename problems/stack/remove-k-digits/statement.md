Remove exactly `k` digits from a number so that what remains — read in the same
order — is as small as possible.

The answer is returned as a string, with no leading zeroes. If every digit is
removed, or what remains is all zeroes, the answer is `"0"`.

## Input

- `digits` — the number as a string of decimal digits
- `k` — how many digits to remove

## Output

The smallest number obtainable by deleting exactly `k` digits, as a string.

## Constraints

- `1 <= digits.length <= 10^4`
- `0 <= k <= digits.length`
- `digits` has no leading zero unless it is exactly `"0"`.

## Examples

### Example 1

Input: `digits = "1432219"`, `k = 3`

Output: `"1219"`

Removing the 4, the 3 and one 2 leaves 1219.

### Example 2

Input: `digits = "10200"`, `k = 1`

Output: `"200"`

Removing the 1 leaves `"0200"`, whose leading zero is dropped.

### Example 3

Input: `digits = "10"`, `k = 2`

Output: `"0"`

Nothing is left, and nothing is written as zero.
