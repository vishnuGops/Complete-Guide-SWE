Cut a word into pieces so that every piece reads the same forwards and backwards.
Report every way to do it.

The pieces of one cutting are in the order they appear in the word. The cuttings
themselves may be reported in any order.

A single letter is a palindrome, so at least one cutting always exists.

## Input

- `word` — a string of lowercase letters

## Output

Every cutting, as a list of lists of pieces.

## Constraints

- `1 <= word.length <= 14`
- `word` contains only lowercase English letters.

## Examples

### Example 1

Input: `word = "aab"`

Output: `[["a","a","b"], ["aa","b"]]`

### Example 2

Input: `word = "abc"`

Output: `[["a","b","c"]]`

Nothing longer than a single letter reads the same both ways.

### Example 3

Input: `word = "aa"`

Output: `[["a","a"], ["aa"]]`
