# The Middle Link

## Approach

The obvious answer walks the chain once to count `n`, then walks `n / 2` links
again. That is correct and is two passes; the classic answer does it in one by
running two walkers at different speeds.

```
slow = head
fast = head
while fast is not null and fast.next is not null:
    slow = slow.next
    fast = fast.next.next
return slow
```

The invariant is arithmetic: after `k` iterations, `slow` has moved `k` links and
`fast` has moved `2k`. The loop stops when `fast` can no longer take two steps,
which happens at `k = floor(n / 2)` — so `slow` is at index `floor(n / 2)`, the
second middle when `n` is even and the only middle when it is odd.

Getting the _other_ middle is a one-token change: `while fast.next is not null
and fast.next.next is not null` stops one step earlier. Which one a problem wants
is worth reading twice.

The same two-speed walk is the engine behind finding the n-th link from the end
and behind cycle detection; this is the smallest place to meet it.

## Complexity

- Time: `O(n)`, one pass.
- Space: `O(1)`.

## Pitfalls

- **Checking only `fast is not null`.** `fast.next.next` then dereferences null
  on an even-length chain. Both conditions are needed, and in that order.
- **Returning the value instead of the link.** The answer is the chain from the
  middle on.
- **Starting `fast` at `head.next`.** That lands on the first middle, which is
  the other problem.
