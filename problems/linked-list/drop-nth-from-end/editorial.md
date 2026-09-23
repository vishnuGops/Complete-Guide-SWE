# Drop The N-th From The End

## Approach

Two walkers with a fixed gap turn "counting from the end" into "counting from
the start", which is the only direction a chain can be walked.

Give the leading walker a head start of `n` links. From then on both move one
link at a time, so the gap stays exactly `n`; when the leader falls off the end,
the follower is exactly `n` links from it — the link to remove.

But removing a link needs the link _before_ it, so the follower should stop one
earlier, and it should start one earlier too. That is where the dummy head earns
its place: put a link before the head, start the follower there, and the case
"the link to remove is the head" needs no code, because the dummy is in front of
the head just as any other link would be.

```
dummy = new link, dummy.next = head
lead = head
follow = dummy
for i in 1..n:  lead = lead.next        # open the gap
while lead is not null:                  # close on the end together
    lead = lead.next
    follow = follow.next
follow.next = follow.next.next           # unlink
return dummy.next
```

`n` is guaranteed to be at most the chain's length, so the first loop never
dereferences null; if it were not guaranteed, that check would be the place for
it.

## Complexity

- Time: `O(n)`, one pass.
- Space: `O(1)`.

## Pitfalls

- **Removing the head without a dummy.** It needs a branch, and forgetting it is
  the most common wrong answer here.
- **A head start of `n` from the wrong place.** Start the leader at `head` and the
  follower at `dummy`: that is the `n + 1` gap that leaves the follower on the
  predecessor.
- **Counting the links first.** Correct, two passes, and it gives up the point of
  the problem.
- **Returning `head`.** When the head is removed it is stale; return
  `dummy.next`.
