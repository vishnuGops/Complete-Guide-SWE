# The Order Of A New Alphabet

## Approach

**What the dictionary tells you.** Take two neighbouring words. Walk them
together to the first position where they differ: that pair of letters is an
ordering fact, and **nothing after that position tells you anything**. If they
never differ within the shorter word's length, the pair says nothing about
letters at all — but if the longer word comes *first*, the dictionary is
impossible, because no alphabet puts a word before its own prefix.

That second case is the one that is skipped, which is why Example 3 exists.

**Then it is `course-order`.** The letters are the vertices, each fact is an
edge, and the answer is a topological order — over at most 26 vertices whatever
the input size. Kahn's algorithm with a **min-heap** of the available letters
gives the smallest valid order, and a run shorter than the number of distinct
letters means a cycle, so the answer is `""`.

Two things worth noticing about the cost. Collecting the facts is `O(total
letters)`, and the ordering afterwards is `O(1)` in the input — 26 vertices and
at most 650 edges no matter how large the dictionary is. And only *neighbouring*
pairs need comparing: if `a < b` and `b < c` in the dictionary's order then
`a < c` follows, so comparing every pair of words adds no facts and costs
`O(words²)` — the trap.

A letter that appears but never takes part in any fact is unconstrained, and
still belongs in the answer.

## Complexity

- Time: `O(total letters)`.
- Space: `O(1)` — 26 letters, whatever the dictionary's size.

## Pitfalls

- **Missing the prefix contradiction.** The only failure with no letters
  involved.
- **Taking facts from beyond the first difference.** `"wrt"` before `"wrf"` says
  `t` before `f` and nothing about `w` or `r`.
- **Comparing every pair of words.** Quadratic, and it adds nothing.
- **Leaving out letters with no constraints.** Every letter that appears is in
  the answer.
- **A queue instead of a heap**, which gives a valid order that is not the
  smallest.
