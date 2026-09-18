Count the ways to place `n` queens on an `n` by `n` board so that no two of them
share a row, a column or a diagonal.

## Input

- `n` — the size of the board and the number of queens

## Output

The number of placements.

## Constraints

- `1 <= n <= 13`

## Examples

### Example 1

Input: `n = 4`

Output: `2`

### Example 2

Input: `n = 1`

Output: `1`

One queen on a one-square board.

### Example 3

Input: `n = 3`

Output: `0`

Three queens cannot avoid each other on a three by three board.

## Notes

Trying every square for every queen is `n^n` placements — over three hundred
billion at `n = 13` — and almost all of them are rejected. The search has to reject them
before they are built, not after.
