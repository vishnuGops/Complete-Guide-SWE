Each booking occupies a room from its start time until its end time. A booking
that ends at 10 and one that starts at 10 can share a room: the first is out
before the second is in.

Given the bookings, report the smallest number of rooms that can hold them all —
which is the largest number of bookings in progress at any one moment.

## Input

- `bookings` — a list of `[start, end]` pairs, in no particular order

## Output

The largest number of bookings that are in progress at the same moment.

## Constraints

- `1 <= bookings.length <= 10^4`
- `0 <= start < end <= 10^9`

## Examples

### Example 1

Input: `bookings = [[0, 30], [5, 10], [15, 20]]`

Output: `2`

`[5, 10]` and `[15, 20]` never overlap each other, but each overlaps `[0, 30]`.

### Example 2

Input: `bookings = [[7, 10], [2, 4]]`

Output: `1`

The two bookings do not overlap, so one room serves both.

### Example 3

Input: `bookings = [[1, 5], [5, 9], [9, 12]]`

Output: `1`

Each booking ends exactly as the next begins, so they can share a room.

## Notes

Counting overlaps booking by booking is `O(n^2)`. At the stated maximum that is
a hundred million comparisons: too slow for the time limit in Python, though
Java's JIT gets through it, and either way it misses the `O(n log n)` target.
Nor can you count per minute: the times run to `10^9`.
