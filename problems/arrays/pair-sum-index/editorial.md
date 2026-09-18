## Approach

The brute force compares every position with every later position, which is
`O(n^2)` and does a lot of redundant work: by the time you are looking at
`values[i]`, you have already seen every earlier element and then thrown that
knowledge away.

Keep it instead. Walk the array once, maintaining a map from value to the index
where that value first appeared. At position `i`, the only value that could
complete the pair is `target - values[i]`, so ask the map for it directly. If it
is there, the answer is `[map[complement], i]` — and because you inserted only
elements strictly before `i`, the two indices are automatically distinct and in
ascending order.

The order of the two steps inside the loop is the whole problem. Look the
complement up **before** inserting the current value. Insert first and
`values = [3, 1]`, `target = 6` will find the 3 you just stored and return
`[0, 0]`.

## Complexity

- Time: `O(n)` — one pass, with amortised `O(1)` map operations.
- Space: `O(n)` — the map holds at most one entry per distinct value.

## Pitfalls

- **Pairing an element with itself.** Insert after the lookup, not before.
- **Overwriting an index on a duplicate value.** Both references keep the
  _earliest_ index (`setdefault` in Python, `putIfAbsent` in Java). With the
  uniqueness guarantee either choice is correct, but they should agree — and the
  habit matters on the variants of this problem that drop the guarantee.
- **Sorting first.** Sorting to use two pointers is `O(n log n)` and, worse,
  destroys the indices you were asked to return. If you sort, you have to carry
  the original positions along, which is more code for a worse bound.
- **Integer overflow in Java.** `target - values[i]` does _not_ always fit in an
  `int`: with `target` and `values[i]` of opposite signs it reaches `2 * 10^9`,
  past `Integer.MAX_VALUE`. The lookup still behaves, and it is worth knowing
  why — a wrapped complement lands outside `[-10^9, 10^9]`, so it cannot collide
  with a key that is really in the map, and the lookup misses exactly as it
  should. The brute force has no such luck: `values[i] + values[j]` wrapping can
  equal `target` and report a pair that does not exist. If you want the
  arithmetic to be honest rather than merely lucky, compute the complement as a
  `long`.

## Why the naive approach is not enough

At `n = 10^5` the quadratic scan is around `5 * 10^9` comparisons, which is far
outside the time limit in either language. The hash map trades `O(n)` memory for
the factor of `n` you cannot afford in time.
