A ladder turns one word into another by changing a single letter at a time, and
**every rung must be a word from the given list**.

Report the number of words in the shortest ladder from `start` to `target`,
counting both ends. If no ladder exists, report `0`.

`start` does not have to be in the list; `target` does, or no ladder can end
there.

## Input

- `start` — the first word
- `target` — the last word
- `words` — the list of allowed words

## Output

The number of words in the shortest ladder, or `0`.

## Constraints

- `1 <= word length <= 10`, and `start`, `target` and every word in `words` are all that same length
- `1 <= words.length <= 5000`
- All words are lowercase, and the list has no repeats.

## Examples

### Example 1

Input: `start = "hit"`, `target = "cog"`,
`words = ["hot", "dot", "dog", "lot", "log", "cog"]`

Output: `5`

`hit → hot → dot → dog → cog`.

### Example 2

Input: `start = "hit"`, `target = "cog"`,
`words = ["hot", "dot", "dog", "lot", "log"]`

Output: `0`

`cog` is not in the list, so no ladder can end there.

### Example 3

Input: `start = "ab"`, `target = "ab"`, `words = ["ab"]`

Output: `1`

The ladder is one word long.

## Notes

Comparing every pair of words to find which differ by one letter is
`O(words² · length)`. At the stated maxima that is more than two hundred million
character comparisons, and it will not finish.
