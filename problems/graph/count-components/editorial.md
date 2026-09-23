# How Many Separate Groups

## Approach

This is `count-islands` with an explicit graph: scan for a vertex not yet
visited, count one component, and visit everything reachable from it.

**Build the adjacency list first.** The input is an edge list, which cannot
answer "who is next to this person" without scanning all of it. One pass turns it
into a list of neighbours per person, and everything after that is `O(1)` per
step:

```
neighbours = list of n empty lists
for [a, b] in links: neighbours[a].append(b); neighbours[b].append(a)
```

Then:

```
groups = 0
for person in 0 .. n-1:
    if not visited[person]:
        groups += 1
        walk from person, marking everything reachable
```

Every vertex and every edge is touched a constant number of times:
`O(n + links)`.

**Union find** answers the same question without a traversal. Start with `n`
groups; for each link, join the two people's groups if they are not already the
same, and subtract one from the count when a join actually merges something. With
path compression and union by size each operation is effectively constant, and
the whole thing is one pass over the links with no adjacency list at all.

Which to reach for: the traversal when you also want _which_ group each person is
in or anything about its shape; union find when links arrive one at a time and
the count is wanted after each — which is what `graph-union-find` is about.

## Complexity

- Time: `O(n + links)`.
- Space: `O(n + links)` for the adjacency list.

## Pitfalls

- **Forgetting that links go both ways.** Adding only `a → b` splits groups that
  are joined.
- **Walking the edge list per vertex.** That is `O(n · links)`.
- **Counting vertices rather than components.**
- **Recursing on a chain of 10,000.** The same depth problem as the grid fills;
  the reference uses an explicit stack.
