# Does It Loop Back

## Approach

The instinct — walk forwards and stop when you reach a place you have seen — is
wrong, and Example 2 is why: reaching a place twice by two different routes is
not a loop. What *is* a loop is reaching a place that is still on the route you
are standing on.

So a place has **three** states rather than two:

- **untouched** — never visited;
- **open** — entered, and the walk is still somewhere below it;
- **closed** — entered and completely finished with.

Walking forwards, meeting an **open** place is a loop; meeting a **closed** one
is nothing at all. A place becomes open when the walk enters it and closed when
the walk leaves it, after every road out of it has been followed.

Written recursively that is three lines, and the states are exactly "on the call
stack" and "returned". Written iteratively — which is what the reference does,
because a chain of 10,000 is possible — the "leaving" moment has to be made
explicit: push each place twice, once to enter and once to leave.

Every place is opened once and closed once and every road is followed once:
`O(n + roads)`.

**The other answer** is Kahn's algorithm from `course-order`: repeatedly remove
places with nothing pointing at them, and if anything is left over it is in a
loop. Same cost, no recursion, and it gives the topological order as a bonus
when there is no loop.

## Complexity

- Time: `O(n + roads)`.
- Space: `O(n + roads)`.

## Pitfalls

- **Two states instead of three.** Example 2 answers `true` and is wrong.
- **Marking closed too early.** Closing a place while the walk is still below it
  is the same bug wearing a different hat.
- **Starting only from place 0.** The graph need not be connected; every
  untouched place has to be tried.
- **Missing the self-road.** `[0, 0]` is a loop, and a walk that skips `to ==
  from` silently misses it.
