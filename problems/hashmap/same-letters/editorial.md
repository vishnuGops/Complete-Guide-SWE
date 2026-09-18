# Built From The Same Letters

## Approach

Rearranging a word changes the order of its letters and nothing else, so
anything that ignores order is a *canonical key*: the same for every
rearrangement, different for anything else. The letter tally — how many times
each letter appears — is such a key, and it is the cheapest one.

So: tally the first word, subtract the second, and check that nothing is left
over. With a fixed alphabet the tally is 26 counters, which is `O(1)` space, and
each word is read once.

Sorting both words is the other canonical key, and it is a perfectly good answer
at `O(n log n)`. The tally is strictly better here only because the alphabet is
small and fixed.

## Complexity

- Time: `O(n + m)`.
- Space: `O(1)` — 26 counters, whatever the words' length.

## Pitfalls

- **Not checking the lengths.** Subtracting a shorter word from a longer one can
  leave every count non-negative while the words plainly differ; the length
  check (or a final scan for non-zero counts) is what rules that out.
- **Comparing sets of letters.** `set("apple") == set("aple")` is true, and the
  words are not rearrangements. Counts matter.
- **Building the second tally separately when you do not need to.** One map and
  a subtraction is enough, and halves the memory.
