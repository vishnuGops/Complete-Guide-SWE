# Trades With A Cooldown

## Approach

The cooldown makes the greedy answer — take every rise — wrong, because a sale
costs you the next day. What works is to name the **states** you can be in at the
end of a day and track the best profit in each.

Three states suffice:

- **holding** — you own an item;
- **sold** — you sold today, so tomorrow is a cooldown day;
- **free** — you own nothing and may buy tomorrow.

Each day, each state's best value comes from the previous day's:

```
holding = max(holding, free - price)      # keep holding, or buy today
sold    = holding + price                 # the only way to sell is to have held
free    = max(free, sold)                 # stay free, or come out of cooldown
```

with `holding` starting at "impossible" (a large negative), and `sold` and `free`
at 0. The answer is `max(sold, free)` on the last day: ending while still holding
is never better than not having bought.

**The updates must all read the previous day's values**, so compute them from a
saved copy rather than in place — updating `holding` first and then using the new
value in `sold` sells an item bought the same day, which the rules forbid.

**Where the cooldown lives.** `free` takes `sold` from the day *before*, not from
today — which is exactly one idle day. Remove that lag and the problem becomes
"buy and sell as often as you like", whose answer is the sum of every rise.

This is the same idea as `house-robber`'s two-state reading, with three states
instead of two, and it is the pattern to reach for whenever a choice today
constrains what is allowed tomorrow.

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- **Updating the states in place.** Each day's values must come from the previous
  day's.
- **Starting `holding` at 0.** That means owning an item for free.
- **Returning `holding`.** Ending while holding is never an improvement.
- **Taking every rise.** Correct without the cooldown, wrong with it.
