# Even Ones First, In Order

## Approach

Two passes and a concatenation is the honest answer:

```
evens = [r for r in readings if r % 2 == 0]
odds  = [r for r in readings if r % 2 != 0]
return evens + odds
```

Nothing is ever reordered inside a group, so the order is preserved by
construction. One pass with two output lists is the same thing.

The reason this problem lives in the sorting topic is the other way of seeing
it: it is a **sort by the key `reading % 2`**, and it is correct *only because
the sort is stable*. A stable sort keeps equal keys in their original relative
order, which is exactly the promise the statement makes. Written that way:

- Python: `sorted(readings, key=lambda r: r % 2)` — `sorted` is stable, so this
  is correct. (`r % 2` in Python is 0 or 1 even for negatives, which is a
  convenience the next language does not share.)
- Java: `Arrays.sort(int[])` takes no comparator and is a dual-pivot quicksort —
  not stable. Sorting by a key means boxing to `Integer[]` and using
  `Arrays.sort(T[], Comparator)`, which *is* stable (a merge sort). That is a
  real allocation for every element, which is why the two-pass version is the
  better answer here even though the sort reads more clearly.

Both are `O(n)` versus `O(n log n)`; the partition wins. The sorting framing is
worth the detour because the moment the key has more than two values — group by
frequency, order by a score — the sort is the only practical answer, and its
stability is what decides the ties.

## Complexity

- Time: `O(n)` for the partition, `O(n log n)` for the sort.
- Space: `O(n)` for the output.

## Pitfalls

- **`reading % 2 == 1` in Java.** For a negative odd number, `%` yields `-1`, so
  the test fails and `-7` is classified as even. Use `reading % 2 != 0`, or
  `(reading & 1) != 0`.
- **Assuming any sort is stable.** It is a property to check, not to hope for.
- **Changing the input.** The statement asks for a new list; partitioning in
  place is the neighbouring problem.
