# Best Single Trade

## Approach

Fix the selling day. The profit is `prices[j]` minus whatever you paid, and the
only thing you control is the purchase, so the best trade ending on day `j` is
`prices[j] - min(prices[0..j-1])`. The answer is the largest of those over all
`j`.

That minimum is a running value: walking the days in order, the smallest price
seen so far is one comparison away from the smallest price seen up to the day
before. So one pass carries two numbers - the cheapest day so far and the best
profit so far - and looks at each price once.

Returning `0` when nothing is profitable is not a special case bolted on: the
best profit starts at `0`, and a market that only falls never beats it.

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- **Trying every pair.** The two nested loops read like the definition and are
  `O(n^2)`; at `n = 10^4` that is a hundred million comparisons for an answer
  available in ten thousand.
- **Selling on the buying day.** Updating the running minimum _before_ computing
  the day's profit allows a zero-length trade. It happens to be harmless here
  (the profit is 0, which the answer already allows), but the same slip in the
  variants that require a real trade is a wrong answer.
- **Assuming the largest price and the smallest price are the trade.** The
  largest may come first; the order is the whole problem.
