## Approach

Sorted input is the whole gift here. Put one pointer at the lightest parcel and
one at the heaviest.

If those two fit within the limit, then so does the lightest paired with anything
between them, because everything between is no heavier than the heaviest. That is
`high - low` pairs counted in one step, after which the lightest parcel is fully
accounted for and the pointer moves in.

If they do not fit, nothing pairs with the heaviest parcel - every other parcel
is at least as heavy as the lightest, which already failed - so the heavy pointer
steps back.

Each step retires one parcel, so the scan is linear after sorting, and the input
arrives sorted.

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- Counting `1` instead of `high - low` when a pair fits turns the answer into the
  number of steps rather than the number of pairs.
- Advancing both pointers when a pair fits skips the pairs in between.
- The count can reach about `2 * 10^8` for the largest inputs, which overflows a
  32-bit accumulator in Java; use `long`.
