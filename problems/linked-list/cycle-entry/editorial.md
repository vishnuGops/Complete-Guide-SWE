## Approach

Two phases, and the second one is the part worth remembering.

**Phase one** is the loop detection from `chain-has-cycle`: a slow pointer one
link at a time, a fast pointer two. If the fast pointer runs out, the answer is
`-1`. Otherwise they meet somewhere inside the loop.

**Phase two** uses where they met. Call the run-up `a`, the distance from the
loop's start to the meeting point `b`, and the rest of the loop `c`. The slow
pointer has travelled `a + b`; the fast pointer has travelled twice that, and it
is at the same place, so its distance is `a + b + k(b + c)` for some number of
laps `k`. Setting the two equal gives `a = k(b + c) - b`, which is to say: `a`
and `c` differ only by whole laps.

So a pointer starting at the head and a pointer starting at the meeting point,
both moving one link at a time, arrive at the loop's start together. Counting
the steps as they go gives the position.

## Complexity

- Time: `O(n)`. Phase one is at most a lap past the run-up; phase two is `a`
  steps.
- Space: `O(1)`. Three pointers and a counter.

## Pitfalls

- **Returning the meeting point.** It is inside the loop but it is not where the
  loop begins, and it happens to be right only when the run-up is a whole
  number of laps - which includes the common `[1, 2]` case, so this bug passes
  the smallest test.
- **Starting phase two from the wrong pointer.** One walker goes back to the
  head; the other stays where they met. Resetting both, or neither, gives the
  head or the meeting point.
- **Stepping two at a time in phase two.** The equality `a = c` mod the lap only
  holds at the same speed.
- **Checking `fast` but not `fast.next`** before the double step, which raises
  on an open chain of odd length rather than answering `-1`.
