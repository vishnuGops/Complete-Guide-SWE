# Where The Dots Go

## Approach

Four numbers, each one to three digits: the search is four levels deep with at
most three branches each, so at most `3^4 = 81` leaves whatever the input. That
is why the complexity is `O(1)` — the input length is capped by the structure,
not by the constraint.

```
build(at, placed):
    if placed == 4:
        if at == digits.length: record the address
        return
    for length in 1 .. 3:
        if at + length > digits.length: break
        piece = digits[at .. at+length]
        if piece has a leading zero and length > 1: break
        if piece as a number > 255: break
        parts.append(piece); build(at + length, placed + 1); parts.pop()
```

**Both rejections are `break`, not `continue`**, and for different reasons. A
leading zero on a two-digit piece means the three-digit piece starting at the
same place also has one, so nothing longer can work. And if a three-character
window already exceeds 255... that one is not monotone in general — `1000` is
longer than `100` but the loop only runs to 3 — so `break` on the value is safe
only because the loop stops at three digits. Writing `continue` is also correct
and costs nothing measurable here; knowing _why_ each is safe is the exercise.

**The counting prunes** are what make a long input cheap:

- fewer digits left than numbers left → impossible;
- more than three times the numbers left → impossible.

With them, a twenty-digit input is rejected at the root instead of exploring 81
leaves.

**The two rules that are always got wrong**: `0` is a legal number and `00` is
not, and `255` is the limit rather than `256`. Example 2 pins the first down.

## Complexity

- Time: `O(1)` — at most 81 leaves.
- Space: `O(1)`.

## Pitfalls

- **Allowing a leading zero.** `010` is not an address, and `0.0.0.0` must still
  be found.
- **Allowing 256.** The range is `0` to `255` inclusive.
- **Finishing with digits left over.** All four numbers being placed is not the
  same as all the digits being used.
- **Not rejecting the length up front.** Under 4 or over 12 digits, nothing is
  possible.
