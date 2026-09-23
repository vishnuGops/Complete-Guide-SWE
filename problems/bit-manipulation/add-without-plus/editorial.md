# Add Without Adding

## Approach

Add two single bits by hand and write down what happens:

| a   | b   | result | carry |
| --- | --- | ------ | ----- |
| 0   | 0   | 0      | 0     |
| 0   | 1   | 1      | 0     |
| 1   | 0   | 1      | 0     |
| 1   | 1   | 0      | 1     |

The result column is exclusive-or. The carry column is `and`. And a carry belongs
one place to the left. Those three observations, applied to every bit position at
once:

```
while second != 0:
    carry  = (first & second) << 1
    first  = first ^ second
    second = carry
return first
```

`first ^ second` is the sum with every carry ignored; `(first & second) << 1` is
every carry, in its right place. Adding those two is the same problem again — so
the loop repeats until nothing is left to carry.

**Why it terminates.** Each round shifts the carries one place further left, and
a 32-bit value has only 32 places; after at most 32 rounds the carry is zero.

**Negative numbers need nothing special in Java**, because two's complement is
exactly the representation this arithmetic assumes: `-2 + 3` works bit for bit
with no case analysis.

**Python is the problem.** Its integers are unbounded, so a negative value has
infinitely many leading one-bits and the carry never runs out — the loop does not
terminate. The fix is to mask to 32 bits each round and convert the result back
to signed at the end: if bit 31 is set, the value represents `answer - 2^32`.
That is the same masking `single-among-triples` needs, and for the same reason.

## Complexity

- Time: `O(1)` — at most 32 rounds.
- Space: `O(1)`.

## Pitfalls

- **Not masking in Python.** An infinite loop on any negative input.
- **Shifting the exclusive-or rather than the `and`.** The carry is the `and`.
- **Swapping the order of the two assignments.** `first` must be updated from the
  old `second`, so the carry is computed first.
- **Assuming the loop runs once.** `1 + 1` needs two rounds, and a chain of ones
  needs many.
