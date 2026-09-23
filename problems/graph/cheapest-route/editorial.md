# Cheapest Route

## Approach

**Dijkstra's algorithm**, and the reason it works is worth stating precisely:
because every toll is positive, the cheapest not-yet-settled place reachable from
the settled ones has its final cost _already_. Any other route to it would have
to leave the settled set through some place that is at least as dear and then pay
more on top.

So settle places in increasing order of cost:

```
cost = [infinity] * n;  cost[start] = 0
heap = {(0, start)}
while heap is not empty:
    (paid, place) = pop the cheapest
    if place is finish: return paid
    if paid > cost[place]: continue          # a stale entry
    for (next, toll) in roads from place:
        if paid + toll < cost[next]:
            cost[next] = paid + toll
            push((paid + toll, next))
return -1
```

**Stale entries** are the practical detail. A place can be pushed several times
as cheaper routes to it are found, and a binary heap cannot cheaply find and
update an old entry. The standard answer is not to try: leave the old entries in,
and skip any that comes out dearer than the best known cost. Each road pushes at
most once, so the heap holds `O(roads)` entries and the whole run is
`O(roads log n)`.

**Returning as soon as the finish is settled** is correct for the same reason
settling is: its cost cannot improve afterwards.

**The trap** is Bellman–Ford — relax every road `n` times. It is the right
algorithm when tolls can be negative, and it is `O(n · roads)`: five hundred
million relaxations at the stated maxima, which does not finish. The positivity
of the tolls is exactly the extra fact that buys the faster algorithm, and the
statement gives it to you on purpose.

## Complexity

- Time: `O(roads log n)`.
- Space: `O(n + roads)`.

## Pitfalls

- **Marking a place settled when it is pushed** rather than when it is popped.
  Its cost is not final until then.
- **Trying to update an entry inside the heap.** Push again and skip the stale
  pop.
- **A plain breadth-first search.** That finds the fewest _roads_, not the
  cheapest tolls, and the two differ the moment tolls differ.
- **Start equal to finish.** The answer is 0, not -1.
