# Its Own Reflection

## Approach

The trick is to stop thinking of it as one tree. "Is this tree its own
reflection?" is "are these two trees mirror images?", asked of the root's two
subtrees.

Two trees are mirror images when:

- both are empty, or
- both exist, their values are equal, and **`a.left` mirrors `b.right`** while
  **`a.right` mirrors `b.left`**.

```
mirror(a, b) = true    if a and b are both null
             = false   if exactly one is null
             = a.val == b.val and mirror(a.left, b.right) and mirror(a.right, b.left)
```

which is `same-shape-trees` with the children crossed over. That crossing is the
entire content of the problem.

The iterative form is a stack (or queue) of pairs, pushing `(a.left, b.right)`
and `(a.right, b.left)` — which is what the reference does, since a tree here can
be 2000 nodes deep.

**Not a level-by-level palindrome check.** Reading each level and asking whether
it is a palindrome is nearly right and is wrong on trees whose missing nodes line
up by accident; the nulls have to be part of the comparison, in position. Pairing
the nodes directly avoids the question.

## Complexity

- Time: `O(n)`.
- Space: `O(depth)`.

## Pitfalls

- **Comparing left with left.** That tests whether the subtrees are *equal*, not
  mirrored — and on a symmetric tree the two happen to agree, so it passes
  Example 1 and fails elsewhere.
- **Forgetting the empty tree**, which is its own reflection.
- **Checking values but not shape.** Example 2 has matching values at every
  present position.
