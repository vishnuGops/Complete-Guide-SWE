# When The Last One Hears

## Approach

"When does machine `v` hear?" is "what is the smallest total delay along a route
from the source to `v`" — which is `cheapest-route` with delay in place of toll.
The difference is that the question is asked about **every** machine at once, and
a single run of Dijkstra answers all of them: it settles machines in increasing
order of time, and every machine's time is final when it is settled.

So: run it to completion rather than returning at a target, then

- if any machine was never settled, it never hears: answer `-1`;
- otherwise the answer is the **largest** settled time, because that is when the
  last machine hears.

Everything else is the same as `cheapest-route`: a min-heap keyed on time, stale
entries skipped rather than updated, `O(links log n)`.

**The shape is worth naming.** `rotting-spread` is this problem with every delay
equal to 1, which is why a plain queue suffices there: with uniform delays the
queue already visits in increasing time order. The heap is what replaces that
when the delays differ — and that is the whole relationship between
breadth-first search and Dijkstra.

**What does not work** is relaxing every link `n` times: `O(n · links)` is five
hundred million at the stated maxima. As in `cheapest-route`, the positivity of
the delays is the fact that buys the better algorithm.

## Complexity

- Time: `O(links log n)`.
- Space: `O(n + links)`.

## Pitfalls

- **Returning at the first unsettled machine.** Every machine must be settled
  before the maximum means anything.
- **Taking the maximum over the heap rather than over the settled times.** The
  heap holds stale entries.
- **A plain queue.** It answers "fewest links", not "earliest tick".
- **`n = 1`.** The answer is 0 and there is nothing to relax.
