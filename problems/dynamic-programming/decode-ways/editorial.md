# Ways To Read The Digits

## Approach

Count the readings of each prefix. A reading of the first `i` digits ends either
with a one-digit letter or with a two-digit one, so

```
ways(i) = ways(i-1)     if digits[i-1] is not '0'          # a one-digit letter
        + ways(i-2)     if digits[i-2..i-1] is 10 .. 26    # a two-digit letter
ways(0) = 1                                                # one way to read nothing
```

That is `stair-ways` with a condition on each term — and the conditions are the
whole problem, because they are what the zeroes break.

**The three things zeroes do:**

- A `0` is never a one-digit letter, so the first term drops out at that
  position.
- `10` and `20` are legal two-digit letters; `30` and above are not, and neither
  is `00`.
- So a `0` must be preceded by a `1` or a `2`, and if it is not, the count at
  that position is zero — and, because every later count multiplies through it,
  the whole answer is zero.

**The two-digit test is a range, not a length.** `07` is two digits and is not a
letter; the test is `10 <= value <= 26`, which rules out every leading zero
without a separate check.

**Space.** Only the last two counts are read, so two variables replace the table —
the same collapse as the stairs.

**Overflow.** A string of `n` ones has `fib(n+1)` readings, so 45 digits give
1,836,311,903 — just inside a signed 32-bit integer, and the reason the length is
capped there.

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- **Treating `0` as a letter.** It is not one, and `"0"` reads zero ways.
- **Allowing `07` as a two-digit letter.** The range test excludes it; a
  length test does not.
- **`ways(0) = 0`.** Everything collapses.
- **Forgetting that a leading zero anywhere kills the whole count.**
