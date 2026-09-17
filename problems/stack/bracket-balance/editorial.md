## Approach

A closing bracket can only ever match the most recently opened bracket that is
still open. "Most recent still open" is the definition of a stack, which is why
this problem is the canonical introduction to one.

Push each opening bracket. On a closing bracket, pop the top and check that the
kinds agree. Two other things can go wrong: a closing bracket arriving when
nothing is open, and brackets still open when the fragment ends. Both are
failures, and forgetting the second is the usual bug - `"((("` passes every
per-character check and is still not balanced.

Counting brackets instead of stacking them fails on `([)]`, where the counts are
right and the nesting is not.

## Complexity

- Time: `O(n)`.
- Space: `O(n)` - a fragment of only opening brackets stacks all of them.

## Pitfalls

- Returning `true` without checking the stack is empty at the end.
- Popping an empty stack on a leading closing bracket.
- Tracking a single counter rather than a stack, which cannot see that `)` closed
  the wrong kind.
