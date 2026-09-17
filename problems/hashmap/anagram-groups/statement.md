A word puzzle groups words that are built from exactly the same letters, used
exactly as many times. `"listen"` and `"silent"` belong together; `"listen"` and
`"listens"` do not.

Return the groups. Every word belongs to exactly one group, and a word with no
partner forms a group of its own.

**Order does not matter** - neither the order of the groups nor the order of the
words inside a group. The judge compares the grouping itself.

## Input

- `words` - a list of strings of lowercase letters; the same word may appear more
  than once, and each occurrence is its own entry

## Output

A list of groups, each a list of the words built from the same letters.

## Constraints

- `0 <= words.length <= 2500`
- `0 <= words[i].length <= 100`, lowercase letters only
- The empty string is a legal word and groups with other empty strings.

## Examples

### Example 1

Input: `words = ["listen", "silent", "enlist", "google"]`
Output: `[["listen", "silent", "enlist"], ["google"]]`

The first three use one `l`, one `i`, one `s`, one `t`, one `e` and one `n`.
`google` shares letters with none of them.

### Example 2

Input: `words = ["ab", "ba", "ab"]`
Output: `[["ab", "ba", "ab"]]`

A repeated word is still a separate entry, and all three use one `a` and one `b`.

### Example 3

Input: `words = []`
Output: `[]`

No words, no groups.
