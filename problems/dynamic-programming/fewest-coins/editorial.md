# Fewest Coins

## Approach

Ask about the **last coin**. Whatever it is, the rest of the problem is the same
question about a smaller amount:

```
fewest(a) = 1 + min over coins c with c <= a of fewest(a - c)
fewest(0) = 0
```

Computed downwards this recomputes the same amounts over and over. Computed
upwards — fill `fewest[0]`, then `fewest[1]`, and so on — every amount is solved
once and every cell reads only cells already filled:

```
fewest[0] = 0
for a in 1 .. amount:
    fewest[a] = infinity
    for coin in coins:
        if coin <= a and fewest[a - coin] + 1 < fewest[a]:
            fewest[a] = fewest[a - coin] + 1
return fewest[amount] == infinity ? -1 : fewest[amount]
```

`O(coins · amount)` time, `O(amount)` space.

**Why greed fails.** Taking the largest coin that fits, repeatedly, gives
`4 + 1 + 1` for `[1, 3, 4]` and 6, when `3 + 3` is better. Greed works for some
coin systems — the ordinary ones are designed so that it does — and the general
problem is not one of them. That is the lesson of Example 3, and it is the reason
this is a dynamic-programming problem rather than a one-liner.

**The sentinel.** "Not reachable" needs a value larger than any real answer.
`amount + 1` is the usual choice, since no answer can exceed `amount` (every coin
is at least 1). Using a true infinity works too; using `-1` inside the loop does
not, because `min` then picks it.

**Against `coin-ways`.** Same table, same two loops, different combining
operation: a sum there, a minimum here. The recurrence is the reusable part.

## Complexity

- Time: `O(coins · amount)`.
- Space: `O(amount)`.

## Pitfalls

- **Greed.** Example 3.
- **`-1` as the unreachable marker inside the table.** It compares as smaller
  than everything and poisons the minimum.
- **`amount = 0`.** The answer is 0 coins, not -1.
- **A recursion without memoisation.** Exponential.
