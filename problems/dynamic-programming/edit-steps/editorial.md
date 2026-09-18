# Fewest Edits

## Approach

A table over pairs of prefixes. Write `cost(i, j)` for the fewest edits turning
the first `i` letters of `from` into the first `j` letters of `into`.

```
cost(i, 0) = i                   # delete every letter
cost(0, j) = j                   # insert every letter
cost(i, j) = cost(i-1, j-1)                          if from[i-1] == into[j-1]
           = 1 + min( cost(i-1, j),                  # delete from[i-1]
                      cost(i, j-1),                  # insert into[j-1]
                      cost(i-1, j-1) )               # replace one with the other
```

**The base row and column are the part that is got wrong.** They are not zeroes:
turning a word of `i` letters into nothing costs `i` deletions. Filling them with
zeroes makes the answer far too small and is the usual first bug.

**Why exactly three options.** Consider the last letter of each word. Either they
are matched with each other — which costs nothing when they are equal and one
replacement when they are not — or one of them is matched with nothing, which is a
deletion or an insertion. There is no fourth possibility, so the minimum of three
covers everything.

**Against `shared-subsequence`.** Same table shape, same fill order, and the same
"look at the last letters" argument — but three options instead of two, because
replacement exists here. The two problems are close enough that the difference is
worth stating: without replacement, the answer would be
`n + m - 2 · sharedLength(start, into)`, which is the deletions-and-insertions
distance.

**Space.** Each row reads only the row above and the cell to its left, so two
rows suffice — and keeping the shorter word along the row makes those rows as
short as possible.

## Complexity

- Time: `O(n · m)`.
- Space: `O(min(n, m))`.

## Pitfalls

- **Zeroes in the base row and column.**
- **Forgetting the free diagonal step on equal letters.** Charging 1 there turns
  every comparison into an edit.
- **Two options instead of three.** That is the edit distance without
  replacement, which is a different number.
- **Recursion without memoisation.** Exponential.
