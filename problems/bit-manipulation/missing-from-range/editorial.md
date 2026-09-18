# The Missing Number

## Approach

Two collections: what is in the row, and what should be. Exclusive-or them all
together. Everything present appears in both, cancels, and contributes nothing;
the missing number appears only in "what should be" and survives.

```
answer = 0
for i in 0 .. n:        answer ^= i
for value in values:    answer ^= value
return answer
```

or fused into one loop by xoring `i` and `values[i]` together at each step.

**The arithmetic version** — expected total minus actual total, where the
expected total is `n(n+1)/2` — is also `O(n)` and `O(1)`, and is the answer most
people find first. The two differ in one respect worth knowing: the sum can
overflow. At `n = 10^5` the total is about five billion, which does not fit in a
32-bit integer, so the arithmetic version needs 64-bit accumulation here while
the xor version cannot overflow at all, because it never produces a value larger
than its inputs.

That is the general point about xor as an accumulator: it is a sum that never
grows.

**Compared with `first-missing-count`**, which also looks for a missing number:
there the values are arbitrary and the answer is the smallest positive absentee,
which needs the row rearranged. Here the values are exactly a range with one
gap — a much stronger promise, and the reason a single pass with one integer
suffices.

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- **Summing in 32 bits.** `n(n+1)/2` is about five billion at the stated maximum.
- **Sorting to find the gap.** `O(n log n)` and it changes the input.
- **A boolean array of what is present.** `O(n)` space, which the constraint
  rules out.
- **Forgetting that `n` itself can be the missing number**, which is the case
  when the row is `0 .. n-1` already in order.
