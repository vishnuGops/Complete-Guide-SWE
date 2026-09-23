# Skip A House

## Approach

The obvious instinct — take every other house, or take the largest ones greedily
— is wrong, and `[2, 7, 9, 3, 1]` shows both failing: alternating from the start
gives 2 + 9 + 1 = 12 (right, by luck), alternating from the second gives 7 + 3 =
10, and greedily taking the 9 then the 7 is illegal.

The reliable way is to ask, at each house, what the best total **up to and
including here** is, and to notice that there are only two cases:

- **Take house `i`** — then house `i - 1` was not taken, so the total is
  `best(i - 2) + houses[i]`.
- **Skip house `i`** — then the total is whatever was best up to `i - 1`.

```
best(i) = max(best(i - 1), best(i - 2) + houses[i])
best(-1) = 0,  best(-2) = 0
```

That is `stair-ways` with a maximum in place of a sum, which is worth seeing:
the _shape_ of a one-dimensional recurrence is the reusable part, and what the
combining operation is varies with the problem.

Only two previous values are ever read, so the table collapses to two variables
rolled forward — `O(1)` space.

**The state-machine reading**, which generalises further: carry two numbers,
"the best if the last house was taken" and "the best if it was not". Each new
house updates both in terms of the old pair. That version extends directly to
`stock-with-cooldown`, where there are three states instead of two.

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- **Taking alternate houses.** It is right surprisingly often and wrong in
  general.
- **Forgetting that skipping two in a row is allowed.** `[5, 1, 1, 5]` is 10, and
  a solution that always takes `i` or `i - 1` cannot find it.
- **Zeroes.** A house holding nothing is still a house, and stepping over it does
  not free its neighbours.
- **A recursion without memoisation.** Exponential, as always.
