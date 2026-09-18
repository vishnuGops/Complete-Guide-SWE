# Every Path That Sums

## Approach

This is `path-sum-exists` with the path itself carried along, and with the walk
continuing after a match instead of stopping.

Carry two things down: the total still needed, and the values on the path so far.
At each node, append its value and subtract it; at a leaf, if the remaining total
is zero, record the path.

```
walk(node, needed, path, out):
    if node is null: return
    path.append(node.val)
    needed -= node.val
    if node is a leaf and needed == 0:
        out.append(a copy of path)
    else:
        walk(node.left,  needed, path, out)
        walk(node.right, needed, path, out)
    path.pop()                      # undo, on the way back up
```

Two details are the content of the problem.

**The undo.** One list is reused for every path, appended to on the way down and
popped on the way up, so its contents always describe the current path exactly.
That is backtracking, and it is what keeps the working memory `O(depth)` rather
than one list per path.

**The copy.** Recording the working list itself stores a reference to something
the walk keeps changing; by the time the answer is read it describes some other
path, usually a partial one. Copy it at the moment it is recorded.

Visiting the left child before the right gives the required order for free.

## Complexity

- Time: `O(n · depth)` — every node is visited once, and each recorded path costs
  a copy of up to `depth` values.
- Space: `O(depth)` for the working path, plus the answer.

## Pitfalls

- **Recording the working list without copying it.** Every answer ends up equal,
  and usually empty.
- **Forgetting to pop.** The path grows monotonically and every later answer is
  wrong.
- **Stopping at the first match.** The question asks for all of them.
- **Treating a node with one child as a leaf.** The same trap as
  `path-sum-exists`.
