# Write It Down And Back

## Approach

Two independent halves, and each is a traversal.

**Reading the pre-order form.** The form works because *every* absent child is
written down. Without the `#`s, `1,2,3` could be several different trees and
nothing in the text says where the left subtree ends. With them, the reader
never has to guess:

```
read():
    token = next token
    if token == "#": return null
    node = new node(token)
    node.left  = read()          # the left subtree is written next, entire
    node.right = read()          # then the right one
    return node
```

A single shared cursor over the tokens is the whole state. The recursion goes as
deep as the tree, so on a chain of 10,000 nodes it needs an explicit stack — the
reference keeps the node being filled and which child is next.

**Writing the level-order form.** A queue, pushing both children of every real
node, writing `#` when a queued entry is absent — and then trimming the trailing
`#`s, which are the absent children of the bottom row and say nothing.

Trailing is the operative word: Example 2 exists so that a `#` in the middle is
not dropped. The level-order form is only readable back if the gaps that have
real values after them are kept.

**Why two forms at all.** Pre-order with `#`s is the natural output of a
recursive writer and reads back with a recursive reader. Level-order is the form
people can read at a glance, and is what this catalogue uses on the wire. Neither
is more correct; converting between them is the exercise, and it cannot be done
by editing text — the tree has to exist in between.

## Complexity

- Time: `O(n)` for each half.
- Space: `O(n)`.

## Pitfalls

- **Trying to rewrite the text directly.** The orders interleave differently at
  every level; there is no local edit that does it.
- **Dropping every `#` rather than the trailing ones.** Example 2.
- **Reading the right subtree before the left.** Pre-order is node, left, right,
  and the reader has to consume them in exactly that order.
- **Recursing on a 10,000-node chain.**
