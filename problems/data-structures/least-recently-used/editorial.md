# Keep The Recent Ones

## Approach

Two questions must both be constant time, and no single structure answers both:

- **Where is this key?** — a hash map.
- **Which entry is least recently used?** — an ordering that supports moving an
  arbitrary entry to the front.

An array or a list-by-value cannot do the second: moving an element from the
middle to the front shifts everything between. A **doubly linked list** can —
unlinking a node needs only its two neighbours, and both are at hand because the
node itself holds them.

So the map stores **key → node**, not key → value, and the list holds the entries
from most recent at the head to least recent at the tail:

```
get(key):   node = map[key] or return -1
            move node to the head
            return node.value

put(k, v):  if k in map: update its value, move to the head, return
            if size == capacity: drop the tail node and remove its key from the map
            insert a new node at the head and record it in the map
```

**The map must be keyed to nodes.** Keying it to values would mean searching the
list to find the node to move, which is the `O(capacity)` scan the design exists
to avoid.

**Dummy head and tail nodes** remove every null check from the unlink and insert
operations — the same trick as the linked-list topic's dummy head, and the reason
this implementation has no special cases for "the list is empty" or "the node is
at the end".

**Evicting the tail needs the tail's key**, which is why each node stores its key
as well as its value: the map entry has to be removed too, and there is no way
back from a value to its key.

**Overwriting an existing key is not an insertion.** It updates and re-orders,
and must not evict anything — Example 3 is there for that.

Both languages have this built in — `LinkedHashMap` with access order in Java,
`OrderedDict` with `move_to_end` in Python — and knowing that is part of the
answer; knowing what they are doing underneath is the rest.

## Complexity

- Time: `O(1)` per operation.
- Space: `O(capacity)`.

## Pitfalls

- **Scanning for the least recent entry.** `O(capacity)` per eviction.
- **A singly linked list.** Unlinking needs the previous node, which a singly
  linked list cannot produce without a scan.
- **Forgetting that `get` counts as a use.** The evictions then all come out
  wrong, which Example 1 catches.
- **Evicting on an overwrite.**
