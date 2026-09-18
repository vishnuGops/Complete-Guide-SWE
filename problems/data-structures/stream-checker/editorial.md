# Does The Stream End With

## Approach

The question is about the **end** of the stream, and the end is exactly the part
that changes with every letter. A trie of the words as written is the wrong shape
for it: checking every word against the last few letters means starting the walk
at a different place each time.

**Read backwards and the problem becomes a prefix problem.** A suffix of the
stream, reversed, is a prefix of a reversed word. So:

- store the **reversed** words in a trie;
- keep the stream's letters in a list;
- on each `next`, walk the stream backwards from the newest letter, following the
  trie downwards, and report `true` the moment a node marks the end of a
  (reversed) word.

```
next(letter):
    stream.append(letter)
    node = root
    for i from stream.length - 1 down to 0:
        node = node.children[stream[i]]
        if node is null: return false
        if node ends a word: return true
    return false
```

The walk stops as soon as the trie has no such child, which is at most after the
longest word's length — so each letter costs `O(longest word)` regardless of how
long the stream has run.

**Only the last few letters matter.** Nothing older than the longest word can be
part of a match, so the stream can be kept in a fixed-size ring buffer rather
than growing without bound — the difference between a toy and something that can
run for a month.

**The alternative** is the Aho–Corasick automaton, which answers each letter in
`O(1)` by precomputing, for every trie node, where to fall back to when a letter
does not match. It is the right answer when the letters are many and the words
are long; the reversed trie is a few lines and is `O(longest word)`, which for
words of twenty letters is nothing.

## Complexity

- Time: `O(longest word)` per letter.
- Space: `O(total letters in the words)`.

## Pitfalls

- **A trie of the words as written.** Every call then has to try every possible
  starting position.
- **Checking the end-of-word marker only at the end of the walk.** A match can
  complete at any depth, and the shortest matching word wins.
- **Keeping the whole stream.** It grows without bound; only the longest word's
  worth is ever read.
- **Scanning every word against the stream's tail.** `O(words · length)` per
  letter, which is the design this replaces.
