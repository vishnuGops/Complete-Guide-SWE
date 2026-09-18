# Two Colours, No Clashes

## Approach

Put somebody in room A. Everybody they dislike must be in room B, everybody
*those* people dislike must be back in A, and so on: **one choice forces the
whole connected group**. So the algorithm is a walk that assigns the opposite
room to every neighbour and checks for a contradiction:

```
room = [unassigned] * n
for each person with no room yet:
    room[person] = A
    walk outwards; for each neighbour:
        if unassigned: give it the opposite room and continue the walk
        else if it has the same room as the person we came from: return false
return true
```

Each group is walked once and each pair is checked twice, once from each end:
`O(n + dislikes)`.

**Every group is independent.** The graph need not be connected, and each group
picks its own starting room freely — which is why the loop starts a fresh walk
from every unassigned person rather than only from person 0.

**What makes it impossible** is an odd ring. Alternating around a ring works
exactly when its length is even; an odd one brings you back to the start needing
the opposite of what you began with. Example 2 is the smallest case, and the
general statement — a graph is two-colourable exactly when it contains no
odd-length cycle — is the theorem this problem is the constructive proof of.

Breadth-first or depth-first makes no difference; the forcing is the same either
way.

## Complexity

- Time: `O(n + dislikes)`.
- Space: `O(n + dislikes)`.

## Pitfalls

- **Starting only from person 0.** Other groups are never checked.
- **Checking only unassigned neighbours.** The contradiction is found on an
  *assigned* one; skipping those finds nothing.
- **Three states where two will do.** Assigned-A, assigned-B and unassigned is
  all that is needed — often written as 1, -1 and 0.
- **Assuming a disconnected person breaks it.** Somebody nobody dislikes goes in
  either room.
