# Ways To Make The Amount

## Approach

Build a table `ways[0 .. amount]` where `ways[a]` is the number of ways to make
`a`. The base case is `ways[0] = 1` — one way to make nothing, by taking no
coins — and everything else grows from it.

**The loop order is the whole problem.**

```
ways[0] = 1
for coin in coins:                     # coins OUTSIDE
    for a in coin .. amount:
        ways[a] += ways[a - coin]
```

With the coins on the outside, each way is built by considering the coins in one
fixed order: every combination is counted once, because there is only one order
in which it can be assembled.

Swap the loops — amounts outside, coins inside — and you count **sequences**
instead: `1+2` and `2+1` become two different answers. That is not a bug to be
patched; it is a different, equally useful question ("in how many ordered ways"),
and knowing which loop order answers which is the thing to take away.

Each cell is touched once per coin, so the whole table costs `O(coins · amount)`
time and `O(amount)` space.

**Against `sum-combinations`.** That problem asks for the combinations themselves
and there can be exponentially many, so enumerating is the only option. This one
asks only how many, and the table never writes one down — which is why it is
polynomial where the other cannot be. Recognising that "count them" and "list
them" are different questions with different ceilings is worth more than the
recurrence.

## Complexity

- Time: `O(coins · amount)`.
- Space: `O(amount)`.

## Pitfalls

- **Looping amounts outside coins.** Counts orderings, not combinations.
- **`ways[0] = 0`.** The table never starts and every answer is zero.
- **Iterating the inner loop downwards.** That is the *bounded* knapsack, where
  each coin may be used once; here the supply is unlimited and the loop runs
  upwards.
- **Enumerating the combinations.** Exponential for a polynomial question.
