## Approach

There is nothing to search in the input here; the search is over the *answer*.

Two observations make that work. First, a capacity is easy to check: fill each
day greedily until the next parcel would overflow, then start a new day, and see
whether the day count fits in the budget. Greedy is optimal because deferring a
parcel that fits can never reduce the number of days.

Second, workability is monotone - if a capacity works, so does every larger one.
That turns the set of workable capacities into a suffix of the range, and finding
where a suffix starts is exactly the boundary binary search.

The range is bounded below by the heaviest single parcel (nothing smaller can
carry it) and above by the total weight (which always finishes in one day).

## Complexity

With `S` the total weight:

- Time: `O(n log S)` - a linear feasibility check per binary-search step.
- Space: `O(1)`.

## Pitfalls

- Starting the search at `1` rather than `max(weights)` lets the feasibility
  check loop forever on a parcel that never fits.
- Counting days with an off-by-one - the first day exists before any parcel is
  placed, so a fresh count starts at one.
- Using the boundary search shape from `first-not-below` but keeping `mid - 1` on
  the success branch, which skips the smallest workable capacity.
