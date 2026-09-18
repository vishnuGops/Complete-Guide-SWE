# Smallest After Removing

## Approach

The greedy rule is about *place value*. Among all the digits you could delete,
the one that helps most is the first digit that is followed by a smaller one:
deleting it pulls every later digit up one place, and the place it vacates is
filled by something smaller. Deleting anything further right changes a less
significant place, so it can never be better.

Applying that repeatedly is a stack that is kept non-decreasing:

```
kept = empty stack
for each digit d:
    while k > 0 and kept is not empty and kept.top > d:
        kept.pop(); k -= 1
    kept.push(d)
```

Two loose ends, and both matter.

**Removals left over.** If the digits were already non-decreasing — `"12345"` —
nothing is ever popped. What remains is ascending, so its largest digits are at
the *end*, and the remaining `k` deletions come off the back.

**Leading zeroes.** `"10200"` with `k = 1` leaves `"0200"`, which is the number
200. Strip the leading zeroes at the end, and if nothing survives, the answer is
`"0"` — which also covers `k` equal to the whole length.

Each digit is pushed once and popped at most once, so the pass is `O(n)`.

## Complexity

- Time: `O(n)`.
- Space: `O(n)`.

## Pitfalls

- **Stopping when `k` reaches zero mid-string.** The remaining digits still have
  to be appended; only the *removing* stops.
- **Forgetting the leftover removals.** `"12345"` with `k = 2` is `"123"`, and a
  stack-only solution returns `"12345"`.
- **Not stripping leading zeroes**, or stripping them so hard that `"0"` becomes
  `""`.
- **Deleting the k largest digits.** Position matters more than size: in
  `"112"` with `k = 1` the answer is `"11"`, not `"12"`.
