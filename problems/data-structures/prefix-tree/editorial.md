# A Tree Of Prefixes

## Approach

A hash set answers `has` in constant time and can only answer `startsWith` by
examining every word it holds. The structure that answers both is a **trie**: a
tree whose edges are letters, so that the path from the root to a node spells a
prefix, and every word beginning with that prefix lives in the subtree below.

Each node holds:

- up to 26 children, one per letter that continues the prefix;
- one boolean, "a word ends here".

Both queries are the same walk — follow one child per letter, failing if a child
is missing — and differ only in the last line:

```
walk(text):  node = root
             for letter in text:
                 node = node.children[letter]  or fail
             return node

startsWith(p) = walk(p) succeeded
has(w)        = walk(w) succeeded and that node ends a word
```

**That boolean is the whole distinction**, and Example 1 exists for it: `app` has
a node, because `apple` was added, but nothing ends there.

Every operation costs `O(length of the string)` — independent of how many words
the dictionary holds, which is the property a hash set of prefixes cannot match
without storing every prefix of every word.

**Space** is one node per distinct prefix, so words sharing a beginning share
their nodes. The 26-slot array per node is the simple choice; a map per node is
smaller when the alphabet is sparse and slower per step.

Adding the same word twice sets a boolean that is already set, which is why it
changes nothing.

## Complexity

- Time: `O(length)` per operation.
- Space: `O(total letters added)`.

## Pitfalls

- **No end-of-word marker.** `has` then answers the same as `startsWith`, and
  Example 1 fails.
- **Marking the _root_ as ending a word.** The empty string is not a word here.
- **A hash set of every prefix of every word.** It works, answers both questions,
  and costs `O(length²)` space per word.
- **Deleting by clearing the marker only.** Not asked for here, and the reason
  nodes usually also carry a count.
