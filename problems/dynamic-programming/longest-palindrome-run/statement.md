Report the longest unbroken run of letters inside `word` that reads the same
forwards and backwards.

If several runs tie for the longest, report the one that starts earliest.

## Input

- `word` — a string of lowercase letters

## Output

The longest palindromic substring, earliest one if there is a tie.

## Constraints

- `1 <= word.length <= 1000`
- `word` contains only lowercase English letters.

## Examples

### Example 1

Input: `word = "babad"`

Output: `"bab"`

`"aba"` is also three long; `"bab"` starts earlier.

### Example 2

Input: `word = "cbbd"`

Output: `"bb"`

### Example 3

Input: `word = "abc"`

Output: `"a"`

No run of two or more reads the same both ways, so the first single letter wins.
