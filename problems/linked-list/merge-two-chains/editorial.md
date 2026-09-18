# Merge Two Ordered Chains

## Approach

Both chains are sorted, so the smallest link overall is the head of one of them —
and after taking it, the same is true of what remains. That is the whole
algorithm: compare the two heads, take the smaller, advance, repeat.

The awkward part is not the comparison, it is the bookkeeping. Appending to a
chain needs a `tail` to append to, and at the start there is no tail because
there is no chain yet. Every branch would need "is this the first link?".

The **dummy head** removes that. Allocate one link that stands before the real
head, append to it exactly as you would to any other link, and return
`dummy.next` at the end:

```
dummy = new link
tail  = dummy
while first is not null and second is not null:
    if first.val <= second.val:
        tail.next = first;  first  = first.next
    else:
        tail.next = second; second = second.next
    tail = tail.next
tail.next = first if first is not null else second
return dummy.next
```

The final line is worth noticing: when one chain runs out, the other's remainder
is already sorted and already linked, so it is attached in one assignment rather
than copied link by link.

Using `<=` rather than `<` keeps equal values in the order the two chains had
them — the merge is *stable*, which matters the moment this is the inner step of
a merge sort.

## Complexity

- Time: `O(n + m)`.
- Space: `O(1)` — one dummy link, whatever the chains' length.

## Pitfalls

- **Building new links.** It works and allocates `n + m` links for no reason; the
  links you were handed are already the right shape.
- **Forgetting the remainder.** Stopping when one chain empties and returning is
  a chain that is missing its tail.
- **Returning `dummy`.** The dummy is not part of the answer; `dummy.next` is.
- **Handling the empty cases separately.** With a dummy head they need no code at
  all: the loop does not run and the remainder line does the work.
