# Level By Level

## Approach

A queue already visits the nodes in level order — the only thing missing is
knowing where one level ends and the next begins.

The trick is one line: **take the queue's size before the round begins.** Those
are exactly the nodes on the current level, because everything added since the
last round came from the level above.

```
result = []
queue  = [root] if root else []
while queue is not empty:
    width = queue.size            # this level, and nothing from the next
    level = []
    repeat width times:
        node = queue.pop_front()
        level.append(node.val)
        push node.left and node.right if they exist
    result.append(level)
```

That is the same "process one whole level" idea as `rotting-spread`, used here
to shape the output rather than to count minutes.

Only existing children are pushed, so the nulls of the wire form never appear in
the answer. The empty tree produces an empty list rather than a list containing
an empty level — a distinction worth reading twice.

A depth-first walk can also produce this, by carrying the level number down and
appending into `result[level]`, creating the list when a level is first reached.
It is a good trick and it is the natural answer to `right-hand-view`; the queue
is clearer here.

## Complexity

- Time: `O(n)`.
- Space: `O(width)` for the queue, which is `O(n)` for a wide tree.

## Pitfalls

- **Not fixing the level's width first.** Reading `queue.size` inside the round
  sees the next level's nodes arriving and merges the two.
- **Pushing nulls.** They are not part of any level here.
- **Returning `[[]]` for the empty tree.**
- **Using a list and `pop(0)` in Python.** That is `O(n)` per removal and turns a
  linear walk quadratic on a wide tree; `collections.deque` is the right
  structure.
