# Collapse Repeated Links

## Approach

Sorted input means equal values are adjacent, so a run of duplicates can be
recognised and skipped by looking one link ahead — no set, no counting, `O(1)`
space.

The structure is a `previous` reference pointing at the last link that survived,
and a `current` walking the chain:

```
dummy = new link, dummy.next = head
previous = dummy
current  = head
while current is not null:
    if current.next is not null and current.val == current.next.val:
        value = current.val
        while current is not null and current.val == value:
            current = current.next      # skip the whole run
        previous.next = current         # splice the run out
    else:
        previous = current              # keep this link
        current = current.next
return dummy.next
```

Two details carry it.

**The dummy head.** Both the head and *every* link can be removed, so `previous`
must exist before the first link does. With a dummy, `previous.next = current`
works identically whether the run started at the head or in the middle, and the
answer is `dummy.next`.

**`previous.next` is assigned after the skip, not during it.** The run's length is
not known in advance; assigning once at the end splices out however much was
skipped in one step.

The neighbouring problem — keep *one* copy of each value rather than none — is
strictly easier: it never removes the head, so it needs no dummy and no
`previous`. Which of the two is being asked is worth reading twice.

## Complexity

- Time: `O(n)`, one pass.
- Space: `O(1)`.

## Pitfalls

- **Keeping one copy.** The common misreading; `[1,1]` answers `[]` here, not
  `[1]`.
- **No dummy head.** `[1,1,1,2]` changes the head and `[1,1]` empties the chain;
  both need a branch without one.
- **Advancing `previous` inside the skip.** `previous` must stay on the last
  *kept* link; moving it into the run links the duplicates back in.
- **Comparing against `previous.val` instead of looking ahead.** It works only if
  you also remember whether the previous link was itself part of a run.
