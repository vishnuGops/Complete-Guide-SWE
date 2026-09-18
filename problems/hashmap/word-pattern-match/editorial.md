# Same Shape, Different Words

## Approach

The pairing between letters and words has to be a **bijection**: every letter
stands for one word, and every word is stood for by one letter. Two maps is the
straightforward way to enforce both halves, and one map enforces only the first.

Split the sentence into words, check that there are as many words as letters,
then walk the two sequences together. At each position with letter `c` and word
`w`:

- If `c` is already bound, it must be bound to `w`.
- If `w` is already claimed, it must be claimed by `c`.
- Otherwise bind them to each other.

Any violation is an immediate `false`; surviving the walk is `true`.

The other way to see it is as a canonical key. Rewrite both sequences as "the
position at which each symbol first appeared" — `abba` and `rain snow snow rain`
both become `0 1 1 0` — and compare the results. That is the same bijection test,
phrased as equality of two normalised forms, and it is worth recognising because
the same trick answers "are these two sequences the same shape" for any alphabet.

## Complexity

- Time: `O(n)` in the length of the sentence.
- Space: `O(n)` for the two maps.

## Pitfalls

- **Only mapping one way.** `"abab"` against `"rain rain rain rain"` passes a
  letter-to-word check and is wrong. This is the case the problem exists for.
- **Not comparing the counts.** Walking in lockstep over sequences of different
  lengths either crashes or quietly succeeds on a prefix.
- **Splitting a sentence with awkward spacing.** The constraints rule out
  doubled and trailing spaces here, but a split that yields empty words is the
  usual source of a wrong answer when they are not ruled out.
