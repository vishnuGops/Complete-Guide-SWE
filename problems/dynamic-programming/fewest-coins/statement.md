You have an unlimited supply of each coin. Report the fewest coins that make
exactly `amount`, or `-1` if no combination does.

## Input

- `coins` — the coin values available, all different
- `amount` — the total to make

## Output

The fewest coins needed, or `-1`.

## Constraints

- `1 <= coins.length <= 12`
- `1 <= coins[i] <= 10^4`
- `0 <= amount <= 10^4`
- All coin values are different.

## Examples

### Example 1

Input: `coins = [1, 2, 5]`, `amount = 11`

Output: `3`

5 + 5 + 1.

### Example 2

Input: `coins = [2]`, `amount = 3`

Output: `-1`

### Example 3

Input: `coins = [1, 3, 4]`, `amount = 6`

Output: `2`

3 + 3. Taking the largest coin first would give 4 + 1 + 1, which is three.

## Notes

Example 3 is why greed does not work here, and the general shape — try every coin
at every amount — is exponential unless each amount is solved once.
