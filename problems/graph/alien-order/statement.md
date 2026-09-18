A dictionary from an unfamiliar language lists its words in that language's
alphabetical order. The letters are the usual lowercase ones, but their order is
not.

Work out an order of the letters consistent with the dictionary, and return it as
a string. Only the letters that actually appear in the words are included.

If the dictionary contradicts itself, return the empty string. If several orders
are consistent, return the one that comes first in **our** alphabet.

## Input

- `words` — the dictionary's words, in its own alphabetical order

## Output

The letters that appear, in the language's order, or `""` if no order is
consistent.

## Constraints

- `1 <= words.length <= 1000`
- `1 <= word length <= 20`
- All words are lowercase.

## Examples

### Example 1

Input: `words = ["wrt", "wrf", "er", "ett", "rftt"]`

Output: `"wertf"`

### Example 2

Input: `words = ["z", "x", "z"]`

Output: `""`

`z` comes before `x` and `x` before `z`.

### Example 3

Input: `words = ["abc", "ab"]`

Output: `""`

A word cannot come before one of its own prefixes, whatever the alphabet.

## Notes

Example 3 is the case with no letter comparison in it at all — the contradiction
is about length, and a solution that only compares letters silently accepts it.
