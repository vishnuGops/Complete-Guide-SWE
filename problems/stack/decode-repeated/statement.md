A shorthand writes a repeated run as a count followed by the run in square
brackets: `3[a]` means `aaa`, and `2[ab]3[c]` means `ababccc`.

Brackets nest, and a count applies to everything inside its own brackets:
`2[a3[b]]` is `abbbabbb`.

Expand the shorthand.

## Input

- `shorthand` — the encoded string

## Output

The expanded string.

## Constraints

- `1 <= shorthand.length <= 100`
- `shorthand` contains only lowercase letters, digits, `[` and `]`.
- Every `[` has a matching `]` and is preceded by a count of at least 1.
- Counts are at most 300, and the expanded string is at most `10^5` characters.

## Examples

### Example 1

Input: `shorthand = "3[a]2[bc]"`

Output: `"aaabcbc"`

### Example 2

Input: `shorthand = "2[a3[b]]"`

Output: `"abbbabbb"`

The inner `3[b]` expands first, giving `abbb`, which the outer 2 then doubles.

### Example 3

Input: `shorthand = "abc"`

Output: `"abc"`

A shorthand with no repetition expands to itself.
