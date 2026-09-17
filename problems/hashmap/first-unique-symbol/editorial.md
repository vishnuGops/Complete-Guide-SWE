## Approach

The answer depends on the whole message, so a single pass cannot decide it: the
first letter might repeat at the very end.

Two passes do. The first counts how often each letter appears. The second walks
the message in order and returns the index of the first letter whose count is
one. Walking the message rather than the counts is what makes the answer the
earliest position rather than an arbitrary one.

With only 26 possible letters, the counts fit in a fixed-size array, which is
what makes the space constant rather than proportional to the input.

## Complexity

- Time: `O(n)` - two passes.
- Space: `O(1)` - 26 counters, whatever the message length.

## Pitfalls

- Returning the letter instead of its index.
- Scanning the count structure in the second pass, which finds *a* unique letter
  but not necessarily the first one in the message.
- Forgetting the empty message, which must answer `-1` rather than crash.
