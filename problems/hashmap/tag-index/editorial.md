## Approach

`count` is the operation that decides the design. Answering it by scanning the
items would be linear, so the count has to be maintained as items move rather
than computed on demand.

That means two maps:

- `tagOfItem`: item to the tag it currently carries.
- `itemsPerTag`: tag to how many items carry it.

The second is derived from the first, which makes it a _cached_ value and makes
consistency the whole job. Exactly one place changes an item's tag, and it
always does the same three things: read the old tag, decrement its count, then
write the new tag and increment its count.

`remove` is that sequence without the second half. `add` on an item that already
has the tag it is being given still works: the count drops by one and rises by
one.

Dropping a tag from `itemsPerTag` when its count reaches zero is not required for
correctness - `count` can treat a missing tag as `0` - but it keeps the map from
growing with tags nobody uses any more.

## Complexity

- Time: `O(1)` on average per operation.
- Space: `O(n)` in the number of live items and distinct tags.

## Pitfalls

- Overwriting an item's tag without decrementing the old one leaves the old tag's
  count permanently too high. This is the bug the second example exists to catch.
- Removing an unknown item must do nothing rather than decrement a count that was
  never incremented.
- `count` for a tag never seen must answer `0` rather than fail on a missing key.
