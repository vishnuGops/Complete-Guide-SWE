# Evaluate A Postfix Line

## Approach

Postfix exists because it needs no brackets and no precedence rules — and the
reason is that the operands of an operator are always the two most recently
produced values. "Most recently produced" is the definition of a stack.

```
for each token:
    if it is an operator:
        right = pop()
        left  = pop()
        push(left OP right)
    else:
        push(the integer)
return pop()
```

The only place to go wrong is the order of the pops. The stack gives the values
back in reverse, so the *first* pop is the right-hand operand. `+` and `*` do not
care; `-` and `/` do, and `["3","4","-"]` is 3 - 4 = -1, not 1.

**Truncation towards zero** is worth a paragraph because the two languages
disagree by default. Java's `/` on `int` truncates towards zero, which is what
the statement asks for. Python's `//` floors: `-7 // 2` is `-4`. The safe form in
Python is to divide the magnitudes and reapply the sign, or `int(a / b)` when the
values are small enough that the float division is exact — the first is exact
always and does not need that caveat.

## Complexity

- Time: `O(n)`.
- Space: `O(n)` for the stack, which in the worst case holds every operand.

## Pitfalls

- **Popping the operands in the wrong order.** Silent on `+` and `*`, wrong on
  `-` and `/`.
- **Python's floor division.** `-7 // 2` is `-4` and the answer wanted is `-3`.
- **Detecting numbers by "is it not an operator".** That is the right test; the
  wrong one is "does it start with a digit", which classifies `-7` as an
  operator.
- **Returning the stack's size or its first element.** The answer is the single
  value left at the end.
