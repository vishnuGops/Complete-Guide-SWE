# Read The Diagonals

## Approach

Cells on the same bottom-left-to-top-right diagonal are exactly the cells whose
`row + column` is equal. So the traversal is two loops: the outer over the sum
`s`, from `0` to `rows + columns - 2`, and the inner over the cells on that
diagonal.

The only thinking is the inner bounds. With `column = s - row`, both coordinates
must be in range:

- `0 <= row <= rows - 1`
- `0 <= s - row <= columns - 1`, which rearranges to `s - columns + 1 <= row <= s`

Taking the tighter end of each pair:

```
for s in 0 .. rows + columns - 2:
    for row in max(0, s - columns + 1) .. min(s, rows - 1):
        take grid[row][s - row]
```

That is it. No visited marks, no bounds checks inside the loop, and every cell is
taken exactly once because each cell has exactly one value of `row + column`.

The alternative — walk cell by cell with a direction that flips at the edges — is
the same traversal written as a state machine, and it is where the off-by-one
bugs live. The arithmetic form is worth preferring for that reason alone.

The zigzag variant, where alternate diagonals are read in the opposite direction,
is one extra line: reverse the inner range when `s` is odd.

## Complexity

- Time: `O(rows · columns)`.
- Space: `O(1)` beyond the output.

## Pitfalls

- **Using only `min(s, rows - 1)`.** On a wide grid the row can start above 0;
  the lower bound `s - columns + 1` is what keeps `column` on the grid.
- **Assuming the grid is square.** `rows` and `columns` appear in different
  places in the two bounds and are not interchangeable.
- **Reading within a diagonal in the wrong direction.** Increasing `row` means
  going down and to the left.
