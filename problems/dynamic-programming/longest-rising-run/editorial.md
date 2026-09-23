# Longest Rising Run

## Approach

The natural table is `longest[i]` = the length of the longest run ending at
position `i`, computed by looking back at every earlier position. It is correct,
it is easy to write, and it is `O(n²)` — ten billion comparisons at the stated
maximum.

**Turn the question round.** Instead of "how long is the run ending here", ask
"for each length, what is the **smallest value** a run of that length can end
with". Keep that as a list `tails`, where `tails[i]` is the smallest possible
last value of a run of length `i + 1`.

Two facts make it work:

- **`tails` is always sorted.** A longer run's minimal ending cannot be smaller
  than a shorter one's, since chopping the last element off a run of length `i+1`
  leaves a run of length `i` ending on something smaller.
- **Each reading does exactly one thing to it.** If the reading is larger than
  everything in `tails`, it extends the longest run by one and is appended.
  Otherwise it replaces the first entry that is not smaller than it — because a
  run of that length can now end on something smaller, which can only help later.

```
for value in readings:
    i = first index with tails[i] >= value      # binary search
    if i == tails.length: tails.append(value)
    else:                 tails[i] = value
return tails.length
```

`O(n log n)`, and the binary search is `insert-position` exactly.

**`tails` is not the answer.** Its _length_ is correct at every moment; its
contents are usually not a run that appears in the input. Reconstructing an
actual run needs a parallel array of predecessors — worth knowing, and not what
this problem asks for.

**Strictly increasing** is what makes the search `>=` rather than `>`. With `>=`
an equal value replaces the existing entry and the length does not grow, which is
Example 2. Swapping to `>` gives the non-decreasing version, which is the other
problem.

## Complexity

- Time: `O(n log n)`.
- Space: `O(n)`.

## Pitfalls

- **The quadratic table.** Correct, and it does not finish here.
- **Returning `tails` itself.** Its length is the answer; its contents are not a
  subsequence of the input.
- **Getting the strictness backwards.** `>=` for strictly increasing, `>` for
  non-decreasing, and mixing them up silently changes the answer on ties.
