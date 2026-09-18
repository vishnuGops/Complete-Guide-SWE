## Approach

The only operation a chain offers is "go to the next link", so everything has to
come from walking it. Two walkers at different speeds is the trick: send one
forward a link at a time and another two links at a time.

If the chain ends, the fast walker gets there first and the question is
answered. If the chain loops, the fast walker enters the loop and goes round it,
the slow walker follows, and the gap between them closes by one link on every
step - so they must eventually be on the same link. There is nowhere for them to
pass each other, because both only ever move forward along a single track.

That is Floyd's cycle detection, and it needs two variables however long the
chain is.

## Complexity

- Time: `O(n)`. Before the loop, the fast walker covers the run-up; inside it,
  the gap shrinks by one per step, so the meeting happens within one lap.
- Space: `O(1)`. Two pointers.

## Pitfalls

- **Remembering values instead of links.** A set of the values seen reports a
  loop the moment a value repeats, and values are allowed to repeat. Identity is
  what matters: is this the same *link*, not the same number.
- **Stepping the fast pointer without checking twice.** `fast.next.next` needs
  both `fast` and `fast.next` to exist, or an odd-length open chain raises
  instead of answering `false`.
- **Comparing after stepping only one of them.** The two have to move, then be
  compared; comparing before the first step reports a loop on every chain,
  because both start on the head.
- **A set of node identities** does answer it, and costs `O(n)` space. The
  stated target is constant, so it is the wrong answer here even though it is
  not a wrong answer anywhere else.
