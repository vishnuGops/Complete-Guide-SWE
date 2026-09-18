# Longest Shared Reading

## Approach

Ask about the **last letters**. Writing `best(i, j)` for the answer on the first
`i` letters of `first` and the first `j` of `second`:

```
best(i, j) = 0                                   if i == 0 or j == 0
           = best(i-1, j-1) + 1                  if first[i-1] == second[j-1]
           = max(best(i-1, j), best(i, j-1))     otherwise
```

**Why the matching case does not also need a maximum.** When the two last letters
are equal, there is always a longest shared reading that uses them both — take
any longest one and, if it does not use them, swapping its last letter for this
pair cannot shorten it. So the other two options need not be considered, and the
case is a single term rather than a maximum of three. That argument is the only
subtle part of the recurrence.

**When they differ**, at least one of the two last letters is unused, so
discarding each in turn and taking the better covers every possibility.

Filled as a table with `i` and `j` increasing, every cell reads only cells
already filled: `O(n · m)` time, which is a million cells at the stated maximum.

**Space.** Row `i` reads only row `i - 1` and cells to its left in row `i`. So
two rows of `min(n, m) + 1` numbers are enough — or one row plus a saved
diagonal, which is the version worth writing once and remembering.

**Recovering the reading itself** needs the full table (or a second pass), and
walking back from the bottom-right corner: equal letters step diagonally and are
part of the answer, otherwise step towards the larger neighbour. This problem
asks only for the length, which is what allows the row-by-row space saving.

## Complexity

- Time: `O(n · m)`.
- Space: `O(min(n, m))`.

## Pitfalls

- **Substring rather than subsequence.** A reading may skip letters; a substring
  may not, and that is a different (and easier) problem.
- **Taking `max` in the matching case.** Correct but slower, and it hides the
  argument above.
- **Enumerating readings.** `2^n`.
- **Off-by-one on the indices.** `best(i, j)` is about the first `i` and `j`
  letters, so the letters compared are `first[i-1]` and `second[j-1]`.
