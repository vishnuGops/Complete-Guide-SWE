# Letters From A Keypad

## Approach

Each digit contributes exactly one letter, and the choices at different positions
are independent — this is the simplest possible backtracking shape, with no
constraint between the levels at all.

```
build(at, sofar):
    if at == digits.length:
        record sofar
        return
    for letter in letters(digits[at]):
        build(at + 1, sofar + letter)
```

There are between `3^n` and `4^n` answers, which is why `n` is capped at 6.

**The empty input** is the one decision the recursion cannot make for you. Run
as written, it records one empty string; the statement asks for no strings at
all. Deciding that up front, before the recursion, is cleaner than trying to
teach the base case about it.

**Strings or a working buffer?** Appending to a string in the recursive call —
`sofar + letter` — allocates a new string per node. Keeping one mutable buffer
and appending and removing (the `all-subsets` shape) avoids that, and in Java it
matters: `StringBuilder` with `deleteCharAt` on the way back up. At `n = 6` the
difference is invisible; the habit is the point.

An iterative version builds the answers level by level — start with one empty
string and, for each digit, replace the set with every string extended by every
one of that digit's letters. Same work, no recursion, and it is the shape a
breadth-first traversal of this tree takes.

## Complexity

- Time: `O(4^n · n)`.
- Space: `O(n)` besides the answer.

## Pitfalls

- **Returning `[""]` for the empty input.**
- **Getting the keypad wrong.** 7 is `pqrs` and 9 is `wxyz`; the other six carry
  three letters each.
- **Building the strings with repeated concatenation in Java** — correct, and it
  allocates once per character.
