# Fairest Split Into K

## Approach

Optimising directly is hard; **checking a candidate is easy**. That inversion is
the whole pattern.

Ask instead: _given a cap `c`, can the queue be split into at most `k` runs whose
totals all stay within `c`?_ The answer is computed greedily and the greed is
provably right: walk the jobs, add each to the current run while the total stays
within `c`, and start a new run the moment it would not. Any other assignment
uses at least as many runs — pushing a job into the next run can never let you
finish in fewer — so the greedy count is the minimum number of runs for that cap.

So `feasible(c)` is one `O(n)` pass, and it is **monotone**: if a cap works, every
larger cap works too. That makes the set of workable caps an upper interval, and
its lower endpoint — the answer — is a boundary, found by binary search.

The search range needs no cleverness:

- **Low:** `max(loads)`. No cap below the largest single job can ever hold it.
- **High:** `sum(loads)`. One worker taking everything always fits.

```
low, high = max(loads), sum(loads)
while low < high:
    mid = low + (high - low) // 2
    if feasible(mid):
        high = mid
    else:
        low = mid + 1
return low
```

That is `O(n log S)` where `S` is the total — about 34 passes at the stated
maximum, against the `O(n^2 k)` table the problem is usually first attacked with.

Note what the answer is _not_: it is not `ceil(sum / k)`. That value ignores the
requirement that runs be unbroken, and `[7, 2, 5, 10, 8]` with `k = 2` gives 16
rather than the true 18.

## Complexity

- Time: `O(n log S)`.
- Space: `O(1)`.

## Pitfalls

- **Filling a DP table.** `O(n^2 k)` and correct; it does not finish at the
  stated maximum.
- **Starting the search at 0 or at 1.** Below `max(loads)` the feasibility check
  can never succeed, and a greedy loop written without care will spin forever
  trying to place a job that does not fit in an empty run.
- **Integer width.** The total reaches `10^4 · 10^6 = 10^10`, which overflows a
  32-bit `int`. The answer and the running totals need 64 bits.
- **Zero loads.** They are allowed, they always fit, and a feasibility check
  written as "start a new run when the total exceeds the cap" must not create a
  run for them out of order.
