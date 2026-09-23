# A Dictionary With Blanks

## Approach

Without dots, this is exactly `prefix-tree`'s `has`: follow one child per letter
and check that the final node ends a word.

**A dot turns the descent into a search.** At a dot, any child will do, so the
walk branches over all of them and succeeds if any branch does:

```
search(node, at):
    if at == pattern.length: return node ends a word
    letter = pattern[at]
    if letter != '.':
        child = node.children[letter]
        return child != null and search(child, at + 1)
    for each existing child:
        if search(child, at + 1): return true
    return false
```

**The length takes care of itself.** Every step — dot or letter — consumes
exactly one character of the pattern and descends exactly one level, so the
search can only ever finish at nodes whose depth equals the pattern's length. A
word of a different length is at a different depth and is never reached. That is
worth noticing, because a hash-set-based solution has to compare lengths
explicitly.

**The cost.** A dot multiplies the branches by the number of children at that
node — at most 26. With `d` dots the search is `O(26^d · length)` in the worst
case, which is why the statement caps dots at three. A dot in the _first_
position is the expensive one, since the whole dictionary is below the root; a
dot deep in the word costs almost nothing because few nodes are that deep.

**Why a trie rather than a list of words.** Scanning every word and comparing
against the pattern is `O(words · length)` per query and perfectly reasonable for
a small dictionary. The trie wins because words sharing a beginning share the
work of matching it — and a dot at position `k` only branches over the distinct
letters actually present at depth `k`, not over all 26.

This is `regex-match` with a much smaller language — no `*`, so no repetition and
no table, just a branching walk.

## Complexity

- Time: `O(26^dots · length)` per search, `O(length)` per add.
- Space: `O(total letters added)`.

## Pitfalls

- **Treating a dot as "skip a letter".** It matches exactly one.
- **Forgetting the end-of-word check.** `b.` would otherwise match `bad`.
- **Branching over all 26 letters rather than the children that exist.** Correct
  and 26 times slower at every dot.
- **Comparing lengths separately.** The walk already enforces it.
