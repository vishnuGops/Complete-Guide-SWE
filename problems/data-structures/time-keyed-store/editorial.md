# Values Through Time

## Approach

Two structures, one inside the other.

**A map from key to that key's history.** The keys are independent, so nothing
about one key's values affects another's, and a hash map is the whole of that
part.

**A sorted list per key.** The statement promises the times for a key strictly
increase, so appending each `set` to the end keeps the list sorted with no work
at all — `set` is `O(1)`.

`get` is then a boundary search over that list: find the first entry whose time
is **greater** than the one asked about, and the answer is the entry just before
it. If that boundary is at position 0, no entry is early enough and the key held
nothing yet.

```
get(key, at):
    history = map[key] or return ""
    i = first index with history[i].time > at        # binary search
    return i == 0 ? "" : history[i - 1].value
```

`O(log n)` in the number of values that key has held.

**Why the promise matters.** Without "times strictly increase", the list would
have to be kept sorted by insertion — `O(n)` per `set`, or a balanced tree. The
statement gives the promise so that the interesting part is the search, and
noticing which promise makes a design cheap is the transferable skill.

**The boundary search is `first-not-below` again**, with two differences worth
naming: the comparison is `>` rather than `>=` (so an exact time match is found
rather than skipped), and the answer is the entry _before_ the boundary rather
than at it.

## Complexity

- Time: `O(1)` to set, `O(log n)` to get.
- Space: `O(entries)`.

## Pitfalls

- **Searching for an exact time.** The time asked about usually has no entry;
  the question is which entry was most recent.
- **`>=` instead of `>`.** An exact match then returns the _previous_ value.
- **Forgetting the before-the-beginning case.** It is an empty string, not the
  first value.
- **One list for every key.** Each key's history has to be searched
  independently.
