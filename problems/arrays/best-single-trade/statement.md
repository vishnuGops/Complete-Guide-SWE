You are given the price of one item on each of a run of days, in order. You may
buy on one day and sell on a strictly later day, at most once.

Return the largest profit available. If every trade would lose money, return `0`
— you are allowed to do nothing.

## Input

- `prices` — a list of integers, one price per day, in day order

## Output

The largest value of `prices[j] - prices[i]` over all `i < j`, or `0` when that
value is never positive.

## Constraints

- `1 <= prices.length <= 10^4`
- `0 <= prices[i] <= 10^9`

## Examples

### Example 1

Input: `prices = [6, 2, 8, 4, 9, 3]`

Output: `7`

Buy on the second day at 2 and sell on the fifth at 9.

### Example 2

Input: `prices = [9, 8, 5, 4, 2]`

Output: `0`

Prices only fall, so every trade loses money and the answer is to do nothing.

### Example 3

Input: `prices = [2, 4, 1, 9]`

Output: `8`

Buying at 2 and selling at 4 is a profit of 2, but waiting for the dip to 1 and
selling at 9 is better.
