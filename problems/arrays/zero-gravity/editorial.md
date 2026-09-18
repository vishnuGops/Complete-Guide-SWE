# Sink The Zeroes

## Approach

Two positions moving left to right: one reads, one writes. The reader visits
every slot; the writer only advances when a non-zero value is stored. That
single invariant - *everything before the write position is the non-zero values
seen so far, in order* - is what makes the result stable without any extra room.

After the reader finishes, the writer marks how many non-zero values there were,
and everything from there to the end is a zero.

Swapping the read and write slots as you go gives the same result in one sweep:
the value that was at the write position is a zero (or the same slot), so
putting it where the non-zero value came from is harmless.

## Complexity

- Time: `O(n)` — each slot is read once and written at most once.
- Space: `O(1)`. Building a new list and assigning it back is `O(n)` extra, which
  this problem's constraint rules out.

## Pitfalls

- **Rebinding instead of mutating.** In Python, `slots = [...]` inside the method
  changes a local name and the caller sees nothing; `slots[:] = [...]` writes
  through. In Java the array reference is copied, so only element writes are
  visible.
- **Removing zeroes while iterating.** Deleting from a list you are walking skips
  elements, and in Java it is not available at all.
- **Losing stability.** Swapping the current value with the *last* slot moves the
  zeroes in one pass but scrambles the order of what remains.
