# The K-th Smallest In A BST

## Approach

The defining property of a search tree is that an **in-order** walk — left
subtree, node, right subtree — visits its values in ascending order. So the
`k`-th smallest value is simply the `k`-th node that walk reaches, and the walk
can stop there.

Written with an explicit stack, "stop there" is free:

```
stack = empty
node  = root
while true:
    while node is not null:          # go as far left as possible
        stack.push(node)
        node = node.left
    node = stack.pop()               # the next value in order
    k -= 1
    if k == 0: return node.val
    node = node.right                # then its right subtree
```

The inner loop descends to the smallest unvisited value; the pop yields it; the
step right moves on to whatever follows it. Each node is pushed once and popped
once, but only the first `k` are ever reached — `O(depth + k)` rather than
`O(n)`.

A recursive in-order walk that collects all the values into a list and indexes it
is `O(n)` time and `O(n)` space, and is correct. The early stop is the reason to
prefer the iterative form, and it matters when `k` is small and the tree is
large.

**If the tree changed often** and this question were asked repeatedly, the right
answer would be different again: store in each node the size of its subtree, and
descend — go left if `k` is at most the left subtree's size, take the node if it
is one more, otherwise go right with `k` reduced. That is `O(depth)` per query.

## Complexity

- Time: `O(depth + k)`.
- Space: `O(depth)` for the stack.

## Pitfalls

- **Walking pre-order or post-order.** Only in-order is sorted.
- **Counting from 0.** `k = 1` is the smallest value.
- **Sorting the values after collecting them.** The walk already delivers them
  sorted; sorting says the search-tree property was not used.
- **A chain 2000 nodes deep.** The recursive walk needs its limit raised.
