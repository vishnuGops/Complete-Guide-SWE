# Cheapest Way To Connect

## Approach

**Kruskal's algorithm.** Sort the cables by price and take each one that joins
two machines not already connected:

```
sort cables by price
bought = 0, total = 0
for [a, b, price] in cables:
    if not joined(a, b):
        union(a, b)
        total += price
        bought += 1
        if bought == n - 1: return total
return -1
```

**Why greedy is right here** is worth more than the code. Suppose the cheapest
cable `e` joining two groups were left out of some cheapest connected set. That
set still connects the two groups somehow, so it contains a different cable `f`
crossing between them; `f` costs at least as much as `e`, so swapping `f` for `e`
keeps everything connected and costs no more. The greedy choice is therefore
never wrong — that is the *cut property*, and it is the whole justification.

**Union find does the connectivity check** as the cables arrive, which is the
same incremental question as `redundant-link`. Sorting dominates the cost:
`O(cables log cables)`.

**Stopping and failing.** Exactly `n - 1` cables are needed: fewer leaves
something unreachable, more closes a loop. So stop at `n - 1`, and if the offers
run out first, the answer is `-1` — no separate reachability check is needed.
`n = 1` needs none at all and answers 0.

Prim's algorithm is the other standard answer: grow one group, always adding the
cheapest cable leaving it, using a heap. It is the better choice on a dense
graph, where sorting all `n²` cables is the expensive part.

## Complexity

- Time: `O(cables log cables)`.
- Space: `O(n)`.

## Pitfalls

- **Not checking connectivity before buying.** The cheapest `n - 1` cables
  overall are usually not a connected set.
- **Forgetting the `-1`.** Running out of cables is a real outcome.
- **Assuming one cable per pair.** The same pair can be offered twice; sorting
  puts the cheaper one first and the dearer one is then skipped as a loop.
- **`n = 1`.** Zero cables, and the loop never runs.
