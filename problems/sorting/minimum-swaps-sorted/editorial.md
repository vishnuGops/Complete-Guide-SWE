# Fewest Swaps To Sorted

## Approach

Sorting the row tells you where each reading has to go. Write that down as a
permutation `home`, where `home[i]` is the position that should end up holding
whatever `readings[i]` is — equivalently, sort the positions `0..n-1` by their
readings, and the result at index `i` is the position whose reading belongs at
`i`.

A permutation decomposes uniquely into **cycles**: follow "where does this go"
from any position and you eventually return to it. The two facts that finish the
problem:

1. **A cycle of length `L` needs exactly `L - 1` swaps.** Not fewer: every swap
   can put at most two readings home, and the first swap of a cycle can only put
   one home while displacing another. Not more: swapping the current position
   with the position its reading belongs to always places one reading for good
   and shortens the cycle by one.
2. **Cycles are independent.** A swap within one cycle changes nothing about
   another, so the total is the sum over cycles.

So the answer is `Σ (L_c - 1)` over cycles `c`, which is `n` minus the number of
cycles. A sorted row is `n` cycles of length one and therefore zero swaps; a
single cycle covering everything is `n - 1`.

Finding the cycles is a walk with a visited flag: start at an unvisited
position, follow the permutation marking as you go, and count how long the walk
was. Every position is visited once.

## Complexity

- Time: `O(n log n)` for the sort; the cycle walk is `O(n)`.
- Space: `O(n)` for the permutation and the visited flags.

## Pitfalls

- **Simulating selection sort.** It does produce the minimum, and finding each
  minimum is `O(n)`, so the whole thing is `O(n^2)` and does not finish at the
  stated maximum.
- **Counting inversions instead.** That is the answer for _adjacent_ swaps, a
  different and much larger number: `[4,3,2,1]` needs 6 adjacent swaps and 2
  arbitrary ones.
- **Off by one on the cycle length.** A fixed point is a cycle of length 1 and
  costs nothing; it is easy to write a walk that charges it a swap.
- **Duplicates.** They make the target order ambiguous and the cycle argument
  fails; the statement rules them out for a reason.
