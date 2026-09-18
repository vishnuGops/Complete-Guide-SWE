A `shape` is a string of letters, where each letter stands for a word. `"abba"`
means: some word, then a second word, that second word again, then the first
word again.

Given a shape and a sentence of space-separated words, report whether the
sentence has that shape. Each letter must stand for exactly one word, and each
word must be stood for by exactly one letter.

## Input

- `shape` — a string of lowercase letters
- `sentence` — lowercase words separated by single spaces

## Output

`true` if the sentence has the shape, `false` otherwise.

## Constraints

- `1 <= shape.length <= 300`
- `1 <= sentence.length <= 3000`
- `shape` contains only lowercase English letters.
- `sentence` contains only lowercase English letters and single spaces, with no
  space at either end.

## Examples

### Example 1

Input: `shape = "abba"`, `sentence = "rain snow snow rain"`

Output: `true`

`a` stands for `rain` and `b` for `snow`, consistently in both directions.

### Example 2

Input: `shape = "abba"`, `sentence = "rain snow snow snow"`

Output: `false`

`a` would have to stand for both `rain` and `snow`.

### Example 3

Input: `shape = "abab"`, `sentence = "rain rain rain rain"`

Output: `false`

Every letter maps to a word consistently, but `a` and `b` would both stand for
`rain`, and two letters may not share a word.

## Notes

Example 3 is the whole difficulty: one map is not enough. The pairing has to be
one-to-one in both directions.
