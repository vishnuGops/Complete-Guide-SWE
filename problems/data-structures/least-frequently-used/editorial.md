# Keep The Popular Ones

## Approach

This is `least-recently-used` with a second dimension: the count decides, and
recency only breaks ties among equal counts.

**Group the keys by use count.** All keys used once in one group, twice in
another, and so on. Within a group the tie-break is recency, so each group is
itself a recency-ordered list — the doubly linked list from the previous problem,
one per count.

Three pieces of state:

- `value[key]` and `uses[key]` — what the key holds and how often it has been
  used;
- `group[count]` — the recency-ordered list of keys with that count;
- `smallest` — the lowest count any entry currently has.

**Using a key moves it up one group.** Remove it from `group[uses]`, increment
`uses`, add it to the front of `group[uses + 1]`. And if the group it left is now
empty and was the smallest, the smallest becomes one higher.

**Eviction is the tail of `group[smallest]`** — least used, and among those least
recently used, which is exactly the rule.

**Why `smallest` can be tracked in `O(1)`.** It only ever moves in two ways: up
by exactly one, when the last member of the smallest group is promoted; or back
to 1, when a new key is inserted. It never has to be searched for — and that is
the whole reason this design is constant time rather than logarithmic. Reaching
for a heap keyed on the count is the natural instinct and buys `O(log capacity)`
for something the structure already knows.

**Insertion sets `smallest` to 1**, because the new key has one use and nothing
can have fewer.

**Overwriting an existing key** counts as a use and does not evict — the same
rule as the recency cache, and the same trap.

## Complexity

- Time: `O(1)` per operation.
- Space: `O(capacity)`.

## Pitfalls

- **Scanning for the smallest count.** `O(capacity)` per eviction, and the reason
  `smallest` is tracked.
- **Losing the recency order inside a group.** Then Example 2 is decided
  arbitrarily.
- **Forgetting to raise `smallest` when a group empties.** Eviction then looks in
  an empty group.
- **Evicting on an overwrite**, or failing to count `get` as a use.
