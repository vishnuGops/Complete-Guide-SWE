# Largest In Every Window

## Approach

The observation that makes this linear: **a reading with a larger reading after
it is finished**. Every window that still contains it also contains the larger
one, so it can never be an answer again and may be discarded immediately.

Keep only the readings that are still candidates, in a deque. Because each
arrival evicts everything smaller behind it, the deque is always in **decreasing**
order, and its front is the largest reading in the current window.

```
for i, value in readings:
    while deque is not empty and readings[deque.back] <= value:
        deque.pop_back()            # smaller and older: finished
    deque.push_back(i)
    if deque.front <= i - k:
        deque.pop_front()           # too old for this window
    if i >= k - 1:
        record readings[deque.front]
```

Two removals, and they are for different reasons — one is about _value_ (evicted
by something larger) and one is about _age_ (fallen out of the window). Confusing
them is where this goes wrong.

**Why it is `O(n)` despite the inner loop.** Each position is pushed once and
popped once across the whole run, so the total work is linear however long any
single eviction burst is.

**Store positions, not values.** The age check needs to know when a candidate
arrived, and two equal readings are indistinguishable by value.

**`<=` rather than `<` in the eviction.** With equal readings, keeping the older
copy is harmless but pointless — it will fall out of the window first and the
newer one is just as large. Either works here; `<=` keeps the deque shorter.

**Against the alternatives.** Scanning each window is `O(n·k)` and does not
finish at the stated maximum. A max-heap with lazy deletion — the
`window-median-stream` machinery — is `O(n log k)` and is the right tool when
the question is about the _middle_ rather than the end. For the maximum, the
deque is `O(n)` and needs no deletion machinery at all, because the eviction rule
does the deleting.

## Complexity

- Time: `O(n)`.
- Space: `O(k)`.

## Pitfalls

- **Storing values instead of positions.** The age check becomes impossible.
- **Checking age before adding.** The new reading cannot be too old; the check
  belongs after the push, on the front.
- **Popping from the wrong end.** Larger-than checks the back; age checks the
  front.
- **Recording before the first full window.** The first answer is at `i = k - 1`.
