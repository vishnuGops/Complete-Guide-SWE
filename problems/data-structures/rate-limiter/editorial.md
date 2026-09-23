# Allow, Then Refuse

## Approach

The only thing worth remembering is **when** each still-relevant request was
allowed. And "still relevant" means inside the window — so the remembered times
are the most recent ones, and they stop being relevant in the order they arrived.
First in, first out: a queue.

```
allow(at):
    while queue is not empty and queue.front <= at - window:
        queue.pop_front()                  # aged out
    if queue.size < limit:
        queue.push_back(at)
        return true
    return false
```

**Refused requests are not recorded.** The statement says the allowance counts
requests already _allowed_, so a refusal leaves the state untouched — which is
what makes a burst of refusals cost nothing and is the usual reading of a rate
limit.

**The comparison is `<= at - window`**, matching "strictly after `t - window`".
With `window = 5`, a request at tick 1 has aged out by tick 6 but not by tick 5.
Example 2 is there to pin that down; an off-by-one here is the most common bug
and is invisible on most inputs.

**Why it is amortised `O(1)`.** Each allowed request is pushed once and popped
once over the limiter's whole life, so `n` calls cost `O(n)` even though one call
can pop many — the same argument as `queue-from-stacks`.

**Space is `O(limit)`**, not `O(calls)`: the queue never holds more than `limit`
entries, because nothing is pushed once it is full.

**The alternative designs** are worth knowing about. A _fixed window_ — count
requests per aligned block of `window` ticks — is `O(1)` space and allows up to
twice the limit across a block boundary. A _token bucket_ refills at a steady
rate and is `O(1)` space with smoother behaviour, at the cost of not being
exactly "at most `limit` in any window". This problem specifies the sliding
window, which is the strict one, and the queue is what implements it exactly.

## Complexity

- Time: amortised `O(1)` per request.
- Space: `O(limit)`.

## Pitfalls

- **Recording refused requests.** A burst of refusals then keeps the limiter
  refusing forever.
- **`<` instead of `<=` when aging out.** Off by one tick.
- **Comparing against the window's _start_ rather than the request's time.** The
  window moves with the request.
- **Keeping every request ever seen.** The queue only needs the ones inside the
  window.
