# Shortest Covering Stretch

## Approach

The observation that makes this linear: covering is **monotone in the right end
and anti-monotone in the left**. If `log[left..right]` covers the need, then so
does `log[left..right+1]`, and so does `log[left-1..right]`. Neither of those is
shorter, so from a covering stretch the only move worth making is to pull `left`
forward and see whether it still covers.

That gives the shape:

1. Move `right` forward one letter at a time, adding it to a tally.
2. Whenever the stretch covers the need, record it if it is the shortest so far,
   then drop `log[left]` from the tally and move `left` forward — repeating while
   the stretch still covers.

Each index is added once and removed once, so the pass is `O(n)` even though
there are two nested loops.

The part that is easy to get wrong is the cover test. Re-checking the whole
tally at each step puts the alphabet back into the inner loop. Instead keep a
single counter, `short`, of how many *distinct* needed letters are still below
their quota. A letter's contribution changes only when its tally crosses exactly
its quota: on the way up, `tally == quota` means one fewer letter is short; on
the way down, leaving `tally == quota` means one more is. `short == 0` is the
cover test, in `O(1)`.

Ties go to the earliest start for free: windows are examined in order of their
right end, and the best is only replaced on a strictly shorter one.

## Complexity

- Time: `O(n + m)`.
- Space: `O(1)` — the tallies are indexed by letter, and there are 26 of them.

## Pitfalls

- **Re-counting the tally to test the cover.** Correct, and it turns an `O(n)`
  pass into `O(26n)` at best and `O(nm)` at worst.
- **Letting `have[letter]` exceed the quota confuse the count.** Only the exact
  crossing matters; a fourth `a` when three are needed changes nothing.
- **Forgetting letters that are not needed at all.** They still advance `right`
  and still get dropped when `left` passes them; they simply never affect
  `short`.
- **Returning a length instead of the stretch.** The answer is the text, and an
  off-by-one in the slice is the classic way to lose it.
