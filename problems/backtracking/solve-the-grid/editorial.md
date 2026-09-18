# Fill The Number Grid

## Approach

Fill the blanks in a fixed order. At each blank, try the digits that are still
legal there; if none is, return and let the previous blank try its next digit.

```
solve(blank):
    if blank == blanks.length: return true          # every blank filled
    (row, column) = blanks[blank]
    for digit in 1 .. 9:
        if digit is legal at (row, column):
            write it
            if solve(blank + 1): return true
            erase it                                # undo
    return false
```

**Legality is checked before writing**, which is the whole reason this finishes.
Writing every digit into every blank and checking the rules at the end is
`9^blanks` — for a puzzle with fifty blanks that is more arrangements than there
are atoms in anything. Checking as you write means an illegal branch is never
entered.

**Returning `true` upwards** is what stops the search at the first complete
grid. The statement guarantees exactly one, so the first is the answer; a solver
that counts solutions instead would remove that `return` and keep going, which
is how one checks a puzzle is well-posed.

**Bit masks.** Keep `rowUsed[9]`, `columnUsed[9]` and `boxUsed[9]`, each nine
bits. A digit is legal when its bit is clear in all three; writing sets it in all
three and erasing clears it. The box index is `(row / 3) * 3 + column / 3` — the
one piece of arithmetic worth writing down carefully.

**What a real solver adds** is choosing *which* blank to fill next rather than
taking them in order: always the one with the fewest legal digits. That single
change turns the hardest puzzles from minutes into milliseconds, and it is the
general heuristic — most constrained variable first — that applies to every
constraint search, this one and `n-queens-count` alike.

## Complexity

- Time: exponential in the number of blanks in principle; heavily pruned in
  practice.
- Space: `O(1)` — the board is fixed at nine by nine.

## Pitfalls

- **Checking the rules only at the end.**
- **Forgetting to erase on the way back.** The next digit is then tried against a
  grid that still holds the last one.
- **Getting the box index wrong.** `(row / 3) * 3 + column / 3`, with integer
  division.
- **Rebuilding the grid.** The caller sees the cells, not a new grid assigned to
  the parameter.
