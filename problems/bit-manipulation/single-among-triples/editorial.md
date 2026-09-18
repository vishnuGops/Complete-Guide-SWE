# The One Among Triples

## Approach

Exclusive-or is the wrong tool on its own: it cancels in *pairs*, and three
copies of a value xor together to that value rather than to zero. What is needed
is cancellation in **threes**, done per bit.

**The counting version, which is the one to understand first.** For each of the
32 bit positions, count how many values in the row have that bit set. Every value
that appears three times contributes 0 or 3 to that count; the lonely value
contributes 0 or 1. So `count mod 3` is exactly the lonely value's bit:

```
for bit in 0 .. 31:
    ones = number of values with that bit set
    if ones % 3 != 0: set that bit in the answer
```

`O(32n)` time and `O(1)` space, and it is obviously correct.

**The compact version** replaces the 32 counters with two integers. `ones` holds
the bits that have been seen once so far, `twos` the bits seen twice; a bit
reaching three is cleared from both:

```
ones = (ones ^ value) & ~twos
twos = (twos ^ value) & ~ones
```

Every bit position runs its own modulo-3 counter in parallel, encoded in two
bits. It is worth deriving once and then recognising; it is not worth guessing.

**The sign bit is where languages differ.** In Java the bit-31 count works
naturally, because `int` is exactly 32 bits and setting that bit produces a
negative number. In Python integers are unbounded, so the same code produces a
large positive number: the row's bits have to be masked to 32 and the result
converted back — if bit 31 is set, subtract `2^32`. Forgetting that is the
commonest way this problem passes in one language and fails in the other.

**`O(1)` space is the whole constraint.** A frequency map is `O(n)` and is
otherwise a perfectly good answer.

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- **Exclusive-or alone.** It answers a different question.
- **Ignoring the sign bit in a language with unbounded integers.** Negative
  answers come back as large positive ones.
- **A frequency map.** `O(n)` space.
- **`sum(set) * 3 - sum(values)` divided by 2.** Correct in exact arithmetic and
  overflows here.
