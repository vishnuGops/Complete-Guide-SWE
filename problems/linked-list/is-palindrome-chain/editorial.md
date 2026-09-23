# Reads The Same Both Ways

## Approach

The obvious answer — copy the values into an array and compare it with its
reverse — is `O(n)` space. The `O(1)` answer makes the chain itself walkable in
both directions, by reversing half of it.

Three steps, each one a problem already solved:

1. **Find the middle** with the two-speed walk (`middle-link`).
2. **Reverse the second half** in place (`reverse-chain`).
3. **Walk both halves inwards** from their heads, comparing values, and stop when
   the reversed half runs out.

Step 3's stopping condition deserves a look. If the chain has odd length the two
halves differ in length by one, and the extra link is the middle one — which has
no partner and cannot disagree with anything. Ending the comparison when the
reversed half is exhausted skips it for free.

Then **put it back**. The caller handed you a chain, not permission to rearrange
it; reversing the second half again restores it exactly. It is also what makes
the function safe to call twice, which is the kind of thing that shows up as a
mysterious failure when it is missing.

## Complexity

- Time: `O(n)` — three linear passes.
- Space: `O(1)`.

## Pitfalls

- **Comparing against a copied list.** Correct, `O(n)` space, and the constraint
  exists to rule it out.
- **Leaving the chain reversed.** A side effect nobody asked for, and the source
  of failures in whatever runs next.
- **Comparing until the _first_ half runs out.** On an odd chain that walks the
  reversed half past its end.
- **The empty and single-link chains.** Both read the same both ways, and both
  should fall out of the loop conditions rather than needing a branch.
