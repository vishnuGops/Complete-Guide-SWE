## Approach

The property that makes a sliding window work is that legality is *monotone*:
cutting readings off a legal stretch cannot raise its number of distinct values,
so every stretch inside a legal one is also legal. That means the right edge
never has to move backwards.

Grow the window one reading at a time. Keep a count of how many copies of each
value the window currently holds; the number of keys in that map is the number of
distinct values. When the map grows past `limit`, advance the left edge, drop
counts as readings leave, and remove a value from the map when its count hits
zero. The answer is the largest window seen along the way.

Each reading enters the window once and leaves at most once, so the two pointers
together do `O(n)` work despite the nested loop.

## Complexity

- Time: `O(n)`.
- Space: `O(limit)` - the window never keeps more than `limit + 1` distinct keys.

## Pitfalls

- Leaving a zero count in the map makes the distinct count wrong; the key has to
  be removed, not just decremented.
- Measuring the window as `right - left` instead of `right - left + 1` reports
  every answer one short.
- Shrinking with `if` rather than `while` fails when several readings have to
  leave before the window is legal again.
