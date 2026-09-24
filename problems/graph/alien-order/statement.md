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

Input: `words = ["pt", "pm", "tm", "tr", "mrs", "ms"]`

Output: `"ptmrs"`

The neighbouring pairs say `t` before `m`, `p` before `t`, `m` before `r`, `t`
before `m` again, and `r` before `s`: one chain through all five letters.

### Example 2

Input: `words = ["b", "a", "ac"]`

Output: `"bac"`

The only fact is `b` before `a`, and `c` could go anywhere. Of the orders that
fit — `bac`, `bca` and `cba` — `bac` comes first in our alphabet.

### Example 3

Input: `words = ["abc", "ab"]`

Output: `""`

A word cannot come before one of its own prefixes, whatever the alphabet.

## Notes

Example 3 is the case with no letter comparison in it at all — the contradiction
is about length, and a solution that only compares letters silently accepts it.
