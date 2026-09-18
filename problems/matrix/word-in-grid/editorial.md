# Find The Word

## Approach

Depth-first search with backtracking. From a cell whose letter matches
`word[k]`, try each of the four neighbours against `word[k+1]`; a cell is
unavailable while it is on the current path.

```
search(row, column, k):
    if k == len(word):          return true
    if off the grid:            return false
    if board[row][column] != word[k]: return false
    saved = board[row][column]
    board[row][column] = '#'          # mark: cannot match any letter
    found = any of the four neighbours search(.., k + 1)
    board[row][column] = saved        # unmark on the way out
    return found
```

Overwriting the cell is the cheapest possible "visited" set: it is `O(1)` space
and it is automatically scoped to the current path, which is exactly what
backtracking needs. Restoring it on the way out is the half that is forgotten.

**Pruning is what makes this finish.** The branching factor is 3 after the first
step, so a 15-letter word is up to `3^14` paths per starting cell. Two cheap
checks cut the hopeless cases before any of that:

- **Letter counts.** If the board holds fewer `a`s than the word needs, the
  answer is `false` without a single step. This is what rescues the pathological
  case — a 6×6 board of `a` and the word `aaaaaaaaaaaaaab`, where an unpruned
  search explores every path in the grid before failing.
- **Search from the rarer end.** If the word's last letter occurs less often than
  its first, reverse the word. A path spelling the reversed word is the same path
  walked backwards, and starting from the rarer letter means far fewer starting
  cells and far earlier failures.

Neither changes the worst case; both change which inputs reach it.

## Complexity

- Time: `O(rows · columns · 3^len(word))` in the worst case.
- Space: `O(len(word))` for the recursion, and `O(1)` beyond it.

## Pitfalls

- **Not restoring the cell.** The board is corrupted for every later starting
  cell, and the answer becomes wrong rather than slow.
- **A `visited` set that is never cleared between starts.** Same effect.
- **Checking the length against the grid but not the letters.** The letter-count
  check is three lines and is the difference between finishing and not.
- **Allowing diagonal steps.** Four neighbours only.
