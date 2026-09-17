## Approach

Words belong together when they are the same word once you stop caring about
order. That is exactly what a *canonical key* captures: something computed from a
word that is identical for every member of its group and different for every
non-member.

Two keys work. Sorting the letters costs `O(k log k)` per word of length `k`.
Counting the 26 letters and using those counts as the key costs `O(k)` and is the
better fit when words are long.

With a key in hand the problem is a single pass: append each word to the list
stored under its key, then return the lists.

## Complexity

With `L` the total number of letters across all words:

- Time: `O(L)` with counting keys, `O(L log k)` with sorted keys.
- Space: `O(L)` - every word is stored once in its group.

## Pitfalls

- Comparing every word against every other word is `O(n^2 * k)` and is the
  approach this problem exists to replace.
- A key built by adding letter values (`a + b` against `c`) collides: different
  letter sets can share a sum. Keys must be injective.
- Duplicate words are separate entries and both belong in the group; deduplicating
  loses one of them.
