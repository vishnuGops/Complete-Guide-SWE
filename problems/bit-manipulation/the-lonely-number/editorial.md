# The One That Appears Once

## Approach

Exclusive-or has three properties, and together they are the whole solution:

- `x ^ x == 0` — a pair cancels;
- `x ^ 0 == x` — zero is the identity;
- it is commutative and associative — so the order does not matter.

Exclusive-or the whole row together. Every value that appears twice contributes
`x ^ x`, which is 0, whatever order they appear in; the lonely value contributes
itself. One pass, one integer of state.

```
answer = 0
for value in values: answer ^= value
return answer
```

**Why the obvious answers are worse.** A hash set — add on first sight, remove on
second, and one thing is left — is `O(n)` space, which the constraint rules out.
Sorting and scanning for the odd one out is `O(n log n)` and changes the input.
Both are correct, and the xor is `O(1)` space and one line.

**Negatives need no thought.** Exclusive-or works on the two's-complement bits,
and `x ^ x` is 0 for any `x` at all. That is worth checking rather than assuming,
because several of the tricks in this topic _do_ need care with the sign bit.

This is the smallest of a family: `missing-from-range` xors two sequences
together, `two-lonely-numbers` xors everything and then splits the row in two,
and `single-among-triples` replaces "cancels in pairs" with "cancels in threes".

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- **Summing instead.** `sum - 2 * sum(set)` also works and overflows where xor
  cannot.
- **A hash set.** `O(n)` space.
- **Starting the accumulator at the first value and looping from the first
  again.** It cancels itself; start at 0.
