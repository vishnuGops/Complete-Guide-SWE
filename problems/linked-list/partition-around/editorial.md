# Split The Chain Around

## Approach

The answer is two runs joined end to end, and both runs preserve the original
order. Building them separately as you walk gives that for free: append each link
to whichever run it belongs to, in the order you meet it, and neither run is ever
reordered.

Each run needs a tail to append to, and neither has a head to start from — so two
dummy links:

```
lowDummy, highDummy = new link, new link
lowTail,  highTail  = lowDummy, highDummy

for each link in the chain:
    if link.val < pivot: lowTail.next  = link; lowTail  = link
    else:                highTail.next = link; highTail = link

highTail.next = null          # terminate, or the old links leak back in
lowTail.next  = highDummy.next
return lowDummy.next
```

The line that is forgotten is `highTail.next = null`. Every link kept its
original `next` while it was being appended, so the last link of the upper run
still points at whatever followed it in the _input_ — which is usually a link
already in the lower run. Without terminating, the result is a cycle, and the
symptom is a program that never finishes rather than a wrong answer.

The comparison is `<`, not `<=`: links equal to the pivot belong in the upper
group, which Example 2 is there to pin down.

## Complexity

- Time: `O(n)`, one pass.
- Space: `O(1)` — two dummy links.

## Pitfalls

- **Not terminating the upper run.** A cycle, and a hang rather than a wrong
  answer.
- **Swapping values instead of relinking.** It can be made to work and it is not
  stable; the two-run build is both simpler and stable.
- **Returning `lowDummy`.** The dummy is scaffolding; `lowDummy.next` is the
  answer — and it is `highDummy.next` when nothing is below the pivot, which the
  join line already handles.
- **Sorting.** The groups are not required to be sorted, only to keep their
  original order.
