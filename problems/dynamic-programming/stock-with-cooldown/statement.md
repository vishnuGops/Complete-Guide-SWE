You are given the price of one item on each of a run of days. You may buy and
sell as often as you like, but:

- you may hold at most one item at a time, so a purchase must be sold before the
  next purchase;
- after selling, you must wait one whole day before buying again.

Report the largest total profit.

## Input

- `prices` — one price per day, in day order

## Output

The largest total profit, or `0` if no trade is worth making.

## Constraints

- `1 <= prices.length <= 5000`
- `0 <= prices[i] <= 1000`

## Examples

### Example 1

Input: `prices = [1, 2, 3, 0, 2]`

Output: `3`

Buy at 1, sell at 2 (profit 1); wait a day; buy at 0, sell at 2 (profit 2).

### Example 2

Input: `prices = [1]`

Output: `0`

One day is not enough to buy and sell.

### Example 3

Input: `prices = [5, 4, 3]`

Output: `0`

Prices only fall, so doing nothing is best.
