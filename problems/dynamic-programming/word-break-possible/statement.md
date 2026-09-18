The spaces have been removed from a sentence. Given the letters and a dictionary,
report whether the letters can be read as a sequence of dictionary words.

Each word may be used as often as you like.

## Input

- `letters` — the sentence with its spaces removed
- `dictionary` — the words allowed, with no repeats

## Output

`true` if the letters can be read as dictionary words, `false` otherwise.

## Constraints

- `1 <= letters.length <= 300`
- `1 <= dictionary.length <= 1000`
- `1 <= word length <= 20`
- All strings are lowercase, and the dictionary has no repeats.

## Examples

### Example 1

Input: `letters = "applepen"`, `dictionary = ["apple","pen"]`

Output: `true`

### Example 2

Input: `letters = "catsandog"`,
`dictionary = ["cats","dog","sand","and","cat"]`

Output: `false`

`cats and og` and `cat sand og` both fail at the end.

### Example 3

Input: `letters = "a"`, `dictionary = ["a"]`

Output: `true`

## Notes

This is `word-break-all` asking only whether an answer exists. Because it never
builds the readings, nothing about it is exponential — which is the difference
between the two problems.
