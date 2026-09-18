# Shortest Round Trip

## Approach

**What matters part-way through.** Suppose you are mid-trip. To finish optimally
you need to know which cities are already visited and which one you are standing
in — and **nothing else**. The order you visited them in is irrelevant, because
it cannot affect any remaining cost.

That observation collapses `(n-1)!` orders into `2^n · n` states, and it is the
whole idea. Two orders that have visited the same set and end in the same city
are interchangeable, so only the cheaper needs keeping.

**The set fits in an integer.** With `n` at most 12, "which cities are visited"
is 12 bits — bit `i` set means city `i` has been visited. Set operations become
bit operations: `visited | (1 << city)` to add one, `visited >> city & 1` to test
one.

```
best[1][0] = 0                                   # started at city 0, nothing else
for visited in increasing order:
    for at in cities in `visited`:
        for next not in `visited`:
            best[visited | 1<<next][next] =
                min(that, best[visited][at] + distance[at][next])
answer = min over at of best[all visited][at] + distance[at][0]
```

Iterating `visited` in increasing numeric order is enough to guarantee every
state is final before it is read, because adding a city always makes the mask
larger.

`O(2^n · n²)` time — about six hundred thousand updates at `n = 12` — and
`O(2^n · n)` space.

**It is still exponential**, and that is honest: the travelling salesman problem
has no known polynomial algorithm. What the table buys is `2^n · n²` instead of
`n!`, which is the difference between six hundred thousand and forty million at
twelve, and between a table and nothing at twenty.

**Directed costs.** The statement does not promise `distance[a][b] ==
distance[b][a]`, so the trip's direction matters and the answer cannot be halved
by symmetry.

## Complexity

- Time: `O(2^n · n²)`.
- Space: `O(2^n · n)`.

## Pitfalls

- **Forgetting the journey home.** The trip returns to city 0.
- **Indexing the table by the path rather than the set.** That is the `n!`
  version with extra steps.
- **`n = 1`.** The answer is 0, and the loops never run.
- **Reading a state before every way of reaching it has been considered.**
  Increasing mask order is what guarantees it.
