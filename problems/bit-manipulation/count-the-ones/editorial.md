# How Many Bits Are Set

## Approach

**The straightforward loop** shifts the value right one place at a time and adds
the lowest bit. It is correct and takes 31 steps whatever the value.

**Kernighan's trick** takes one step per bit that is actually set:

```
count = 0
while value != 0:
    value &= value - 1
    count += 1
```

**Why `value & (value - 1)` clears the lowest set bit.** Subtracting one from a
binary number flips its lowest set bit to `0` and every bit below it from `0` to
`1` — that is what borrowing does. Anding the two together keeps only the bits
they agree on: everything above the lowest set bit is unchanged in both, the
lowest set bit is `1` in one and `0` in the other, and everything below is `0` in
one and `1` in the other. So exactly one bit disappears.

On a sparse value — one or two bits set — that is two iterations instead of
thirty-one.

**Both languages have this built in**: `Integer.bitCount` and `int.bit_count()`
compile to a single instruction on any modern processor. Knowing that is part of
the answer; knowing why the trick works is the part that transfers, because
`value & (value - 1) == 0` is also the power-of-two test, and the same borrowing
argument explains `value & -value`, which *isolates* the lowest set bit rather
than clearing it.

## Complexity

- Time: `O(bits set)`, at most 31.
- Space: `O(1)`.

## Pitfalls

- **Shifting a negative value right** in a language with arithmetic shift: the
  sign bit is copied and the loop never ends. The constraint keeps the value
  non-negative here, and `>>>` is the fix when it does not.
- **`value % 2` on a negative value** gives `-1` in Java, which counts wrong.
- **Assuming 32 iterations is fine.** It is, here — the trick is about knowing
  the shape, not about this problem's timing.
