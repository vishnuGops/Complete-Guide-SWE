# No Two The Same In A Row

## Approach

**When is it possible?** Think of the answer's positions as alternating slots. A
letter occurring `c` times needs `c` slots no two of which are adjacent, and a
string of length `n` has at most `⌈n / 2⌉` such slots. So an arrangement exists
exactly when every letter occurs at most `⌈n / 2⌉` times — necessary by that
counting, and sufficient because the construction below always succeeds when it
holds.

**The construction.** Greedily place the most frequent letter still available,
never repeating the one just placed:

```
heap = max-heap of (count, letter) for each letter
held = nothing
while heap is not empty:
    (count, letter) = pop()          # the most common letter that is allowed
    append letter
    if held is not nothing: push(held)   # the one from last step is free again
    held = (count - 1, letter) if count > 1 else nothing
```

Holding the just-used letter aside for exactly one step is what forbids a repeat,
and putting it back afterwards is what keeps it in the running. If the heap
empties while a letter is still held, that letter has copies with nowhere to go —
which is exactly the impossible case, and lets the construction detect it
without checking the counting rule up front.

**Why greedy works.** Placing anything other than the most frequent letter leaves
it _relatively_ more frequent among what remains, which can only make the rest
harder. Placing the most frequent one first never does that.

The heap holds at most 26 entries, so each step is `O(log 26)` — effectively
constant. A simpler answer exists for the same reason: sort the letters by
frequency, lay them into the even positions first and then the odd ones, and no
two copies of a letter ever land next to each other. That one is `O(n)` and worth
knowing; the heap is the version that survives a larger alphabet.

## Complexity

- Time: `O(n log 26)`.
- Space: `O(26)` besides the answer.

## Pitfalls

- **Not holding the previous letter back.** The most common letter is chosen
  twice in a row immediately.
- **Placing the least frequent letter first.** It is the natural mirror image and
  it fails: the crowded letter is left with no room.
- **Returning a string that is not a rearrangement.** Every letter has to appear
  as many times as it did.
- **Checking only `count <= n / 2`.** The bound is `⌈n / 2⌉`, so `"aba"` with two
  `a`s in three letters is fine.
