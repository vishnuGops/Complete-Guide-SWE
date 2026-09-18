# Fold The Chain

## Approach

The folded chain is the first half interleaved with the reversed second half, so
the problem is three problems already solved, in sequence:

1. **Find the middle** with the two-speed walk and **cut** there. Cut so the
   first half is the longer one when the length is odd — that is, advance `slow`
   while `fast.next` and `fast.next.next` both exist, and cut after `slow`.
2. **Reverse the second half** in place.
3. **Weave**: take one link from each half in turn, relinking as you go.

The weave is the only new part:

```
first, second = head, reversedSecondHalf
while second is not null:
    afterFirst  = first.next
    afterSecond = second.next
    first.next  = second
    second.next = afterFirst
    first, second = afterFirst, afterSecond
```

Both successors are saved *before* either pointer is overwritten — the same
discipline as reversing, and for the same reason.

The loop ends when the second half runs out, which is why the cut had to leave
the first half no shorter. On an odd chain the extra link is the middle one, and
it is already at the end of the first half with nothing after it — exactly where
the fold wants it.

Cutting matters: `slow.next = null` before reversing. Without it the reversed
second half still points back into the first, and the weave produces a cycle.

## Complexity

- Time: `O(n)` — three linear passes.
- Space: `O(1)`.

## Pitfalls

- **Not cutting at the middle.** The commonest cause of a chain that folds into a
  loop and hangs.
- **Cutting so the second half is longer.** Then the weave runs out of first-half
  links with a second-half link still to place.
- **Copying values into an array and writing them back.** `O(n)` space, which the
  constraint rules out, and it sidesteps the pointer work the problem is about.
- **The empty and single-link chains.** Both are already folded, and both should
  fall out of the loop conditions.
