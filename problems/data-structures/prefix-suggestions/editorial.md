# Suggest As You Type

## Approach

Walking the prefix in a trie lands on a node whose subtree is exactly the words
that begin with it — so the question reduces to "the three alphabetically
smallest words in this subtree".

**Search when asked.** From that node, walk down visiting children in
alphabetical order and collect words as their end-markers are met, stopping at
three:

```
suggest(prefix):
    node = walk(prefix)  or return []
    out = []
    collect(node, prefix, out)
    return out

collect(node, sofar, out):
    if out.size == 3: return
    if node ends a word: out.append(sofar)
    for letter in 'a' .. 'z' in order:
        if node has that child: collect(child, sofar + letter, out)
```

Because the children are visited in order, the words come out in alphabetical
order, and the early stop means the walk never explores more than it needs. The
cost is `O(prefix length)` to get there and roughly `O(k · word length)` to
gather, which is why this design is the usual one.

**Store the answer instead.** The other design keeps, at every node, the three
smallest words that pass through it — updated as each word is added, by walking
the word's path and inserting it into each node's list of three. Then `suggest`
is the walk plus a copy: `O(prefix length + k)` with no search at all, at the
cost of `O(3 · total letters)` space and slower adds.

Which is right depends on the ratio of adds to suggestions, and a real
type-ahead has vastly more suggestions than adds — which is why the stored
version is what production autocompletes use. Saying *why* one design wins is
more of the answer here than either implementation.

**Adding a word twice changes nothing**, since it only sets an end-marker that
is already set — and, in the stored design, inserts into lists it is already in.

## Complexity

- Time: `O(prefix length + k · word length)` per suggestion, with the searching
  design.
- Space: `O(total letters)`.

## Pitfalls

- **Collecting the whole subtree and then sorting.** Correct, and it can walk
  thousands of words to report three.
- **Visiting children in insertion order.** The answer must be alphabetical, and
  a hash map's order is not.
- **Forgetting that the prefix may itself be a word.** It is reported first if
  so.
- **Returning three when fewer exist.** Fewer is right, not padded.
