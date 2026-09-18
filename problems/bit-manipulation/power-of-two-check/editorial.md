# Is It A Power Of Two

## Approach

A power of two is exactly one bit set in binary: `1`, `10`, `100`, `1000`, and so
on. So the question is "does this value have precisely one `1` bit".

`value & (value - 1)` clears the lowest set bit (see `count-the-ones` for why).
If the value had only that one bit, the result is `0`:

```
return value > 0 and (value & (value - 1)) == 0
```

**The `value > 0` is not decoration**, and covers two different failures:

- **Zero.** `0 & -1` is `0`, so the bit test alone says zero is a power of two.
  It is not.
- **Negatives.** In two's complement, `-8` is `…11111000`, which has many bits
  set and correctly fails — but `-2147483648` is a single set bit (the sign bit),
  and the bit test alone would accept it. It is not a power of two either.

So the test is really two claims: the value is positive, *and* it has one bit.

**The other one-liner**, `value & -value == value`, isolates the lowest set bit
and asks whether that is the whole value. It has exactly the same two edge cases
and needs the same guard, which is a hint that the guard is about the problem's
definition rather than about the trick.

**The loop** — divide by two while even, then check the result is 1 — is correct
and takes up to 31 steps. Nothing is wrong with it; the bit test is the thing
worth having read once.

## Complexity

- Time: `O(1)`.
- Space: `O(1)`.

## Pitfalls

- **Forgetting zero.** The commonest failure.
- **Forgetting the most negative value.** Its only set bit is the sign bit.
- **`log2(value)` and checking it is whole.** Floating point, and it is wrong for
  some large values.
