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

Input: `start = "pin"`, `target = "mat"`,
`words = ["pan", "pat", "man", "mat", "pit", "pen"]`

Output: `4`

`pin → pan → pat → mat`. `pin → pit → pat → mat` is just as short; the length is
what counts.

### Example 2

Input: `start = "pin"`, `target = "mat"`,
`words = ["pan", "pat", "man", "pit", "pen"]`

Output: `0`

`mat` is not in the list, so no ladder can end there.

### Example 3

Input: `start = "ab"`, `target = "ab"`, `words = ["ab"]`

Output: `1`

The ladder is one word long.

## Notes

Comparing every pair of words to find which differ by one letter is
`O(words² · length)`. At the stated maxima that is more than two hundred million
character comparisons: too slow for the time limit in Python, though Java's JIT
gets through it. Either way it misses the `O(words · length²)` target.
