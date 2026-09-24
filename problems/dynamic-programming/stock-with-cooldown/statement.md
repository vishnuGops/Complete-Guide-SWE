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

Input: `prices = [2, 6, 4, 1, 7, 5]`

Output: `10`

Buy at 2, sell at 6 (profit 4); rest on the day of 4; buy at 1, sell at 7
(profit 6).

### Example 2

Input: `prices = [6]`

Output: `0`

One day is not enough to buy and sell.

### Example 3

Input: `prices = [1, 2, 1, 2, 1, 2]`

Output: `2`

Every rise is worth 1, but each sale forces a rest day, so only two of the three
rises can be taken.
