# Find It In A Sorted Grid

## Approach

The two sorting conditions together say something stronger than they look:
reading the grid row by row produces **one ascending sequence**. Each row
ascends, and every row starts above where the previous ended, so there is no
break anywhere.

That means the grid can be treated as a sorted list of `rows × columns` values
without ever building it. A position `p` in that imaginary list is the cell

```
row = p / columns,  column = p % columns
```

with integer division, and an ordinary binary search over `0 .. rows·columns-1`
finishes in `O(log(rows·columns))`.

```
low, high = 0, rows * columns - 1
while low <= high:
    mid = low + (high - low) / 2
    value = grid[mid / columns][mid % columns]
    if value == target: return true
    if value < target:  low = mid + 1
    else:               high = mid - 1
return false
```

**When the rows are not related.** If the grid is only sorted along each row and
each column — the more common shape — the flattened sequence is *not* ascending
and this search is wrong. The answer there is the staircase: start at the top
right corner, move left when the value is too large and down when it is too
small, and either find the target or walk off the grid in `O(rows + columns)`.
Knowing which of the two a problem gives you is most of the work.

## Complexity

- Time: `O(log(rows · columns))`.
- Space: `O(1)`.

## Pitfalls

- **Binary searching for the row, then within it.** Correct, and two searches
  where one will do; it also needs care when the target falls between rows.
- **Dividing by the wrong dimension.** The position-to-cell conversion divides by
  the number of *columns*.
- **Searching every row.** `O(rows · columns)`, which ignores the structure the
  problem hands you.
- **Applying this to a merely row-and-column sorted grid.** A different problem
  with a different answer.
