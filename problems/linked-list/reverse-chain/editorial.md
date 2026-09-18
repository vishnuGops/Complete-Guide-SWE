# Reverse The Chain

## Approach

A chain only lets you walk forward, and reversing needs each link to point
backwards — so the link you need is always the one you have just left. Carry it.

```
previous = null
current  = head
while current is not null:
    following = current.next     # save it before it is overwritten
    current.next = previous      # point this link backwards
    previous = current           # both references step forward
    current  = following
return previous
```

The invariant: *everything from `previous` back to the original head is already
reversed, and `current` is the head of what is left*. When `current` runs off the
end, `previous` is the new head — which is also why the empty chain needs no
special case: the loop never runs and `previous` is still null.

Three references, one pass, no allocation. Copying the values into a list,
reversing it and rebuilding the chain is also `O(n)` but uses `O(n)` space, which
the constraint rules out.

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- **Overwriting `current.next` before saving it.** The rest of the chain is then
  unreachable and the walk ends after one link. This is *the* linked-list bug.
- **Returning `head`.** After the reversal the original head is the last link and
  its `next` is null; the new head is `previous`.
- **Starting `previous` at `head`.** It must start at null, or the old head keeps
  pointing at itself and the chain becomes a loop.
