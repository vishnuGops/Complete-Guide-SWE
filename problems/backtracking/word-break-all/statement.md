The spaces have been removed from a sentence. Given the letters and a dictionary,
report every sentence that could have produced them.

Each word of the dictionary may be used as often as you like. The words of a
sentence are joined by single spaces, in the order they appear in the letters.

The sentences may be reported in any order.

## Input

- `letters` — the sentence with its spaces removed
- `dictionary` — the words allowed, with no repeats

## Output

Every sentence that spells `letters`, as a list of strings. An empty list if
there are none.

## Constraints

- `1 <= letters.length <= 20`
- `1 <= dictionary.length <= 20`
- `1 <= word length <= 10`
- All strings are lowercase, and the dictionary has no repeats.

## Examples

### Example 1

Input: `letters = "catsanddog"`,
`dictionary = ["cat","cats","and","sand","dog"]`

Output: `["cats and dog","cat sand dog"]`

### Example 2

Input: `letters = "aaa"`, `dictionary = ["a","aa"]`

Output: `["a a a","a aa","aa a"]`

### Example 3

Input: `letters = "abc"`, `dictionary = ["ab"]`

Output: `[]`

Nothing spells the `c`.

## Notes

The dangerous shape is letters that _almost_ work — twenty `a`s followed by a
`b`, with `a` and `aa` in the dictionary. There are no sentences at all, and a
search that re-explores the same suffix once per way of reaching it does
exponential work to discover that.
