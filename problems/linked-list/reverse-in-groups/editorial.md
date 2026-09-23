# Reverse Every K Links

## Approach

Reversing a whole chain needs two references. Reversing a _segment_ in place
needs two more: the link before the segment, so the reversed piece can be
reattached at the front, and the link after it, so it can be reattached at the
back.

The loop, one group at a time:

```
dummy = new link, dummy.next = head
groupPrev = dummy
loop:
    kth = groupPrev advanced k links        # the group's last link
    if kth is null: return dummy.next       # fewer than k remain: stop
    groupNext = kth.next

    # reverse groupPrev.next .. kth, stopping at groupNext
    previous, current = groupNext, groupPrev.next
    while current is not groupNext:
        following = current.next
        current.next = previous
        previous = current
        current = following

    newTail = groupPrev.next                # the old head is now the group's tail
    groupPrev.next = kth                    # the old kth is now the group's head
    groupPrev = newTail
```

Two tricks are carrying this.

**Look before you leap.** Walking `k` links ahead _before_ touching anything is
what makes the incomplete tail free: if the walk falls off the end, there is
nothing to do and the chain is already correct behind you.

**Seed `previous` with `groupNext`, not null.** The ordinary reversal ends with
the last link pointing at null; here it should point at whatever follows the
group. Seeding the reversal with `groupNext` attaches the tail as a side effect
of the loop rather than as a separate step.

Then the two splice lines, and the order matters: `groupPrev.next` is read (as
`newTail`) before it is overwritten.

The dummy head is what makes the first group no different from the others — the
first group's reversal changes the chain's head, and `groupPrev` needs somewhere
to stand.

## Complexity

- Time: `O(n)` — every link is visited a constant number of times, once by the
  look-ahead and once by the reversal.
- Space: `O(1)`.

## Pitfalls

- **Reversing first and counting after.** If the group turns out to be short you
  have to undo the reversal; looking ahead first avoids the question.
- **Reversing the incomplete tail.** The statement says to leave it, and the
  neighbouring problem says to reverse it — read which one you are answering.
- **Ending the inner reversal at null.** It detaches the rest of the chain.
- **`k = 1`.** Every group reverses to itself; the code should do nothing
  visible, not fall over.
