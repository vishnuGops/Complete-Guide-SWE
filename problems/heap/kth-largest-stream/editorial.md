# K-th Largest, As It Arrives

## Approach

This is `kth-largest-value` asked repeatedly, and the repetition is what makes
the structure matter: nothing may grow with the length of the stream.

Keep a **min-heap of exactly the `k` largest readings seen so far**. Its root is
the smallest of those, which is by definition the `k`-th largest overall — the
answer, in `O(1)`.

Adding a reading:

- if the heap holds fewer than `k`, push it;
- otherwise, if it beats the root, replace the root with it;
- otherwise drop it, because it is not in the top `k` now and never will be —
  future readings can only push it further down.

Each `add` is `O(log k)`, and the memory is `O(k)` however long the stream runs.
That last part is the point: sorting the readings after each one is `O(n log n)`
per call and keeps every reading forever, which for a stream that never ends is
not a solution at all.

The constructor is the same operation applied to a batch, so it can simply call
`add` for each initial reading rather than duplicating the logic.

## Complexity

- Time: `O(log k)` per reading.
- Space: `O(k)`.

## Pitfalls

- **A max-heap of everything.** It answers correctly and grows without bound;
  the min-heap of `k` is what keeps the memory fixed.
- **Popping `k - 1` items to read the answer and pushing them back.** That is
  `O(k log k)` per call for something the root already tells you.
- **De-duplicating.** Duplicates count separately, as in `kth-largest-value`.
- **Answering from the initial batch only.** Every `add` changes the answer.
