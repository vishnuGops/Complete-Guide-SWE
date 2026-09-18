# The Two That Appear Once

## Approach

Exclusive-or the whole row. The pairs cancel, leaving `a ^ b` — the exclusive-or
of the two lonely values. That is not either of them, and it is the key to both.

**What `a ^ b` tells you.** Every bit set in it is a bit where `a` and `b`
differ; because they are different values, at least one such bit exists. Pick one
— conventionally the lowest, which `x & -x` isolates.

**Split the row on that bit.** Every value either has it or does not:

- `a` and `b` land on **opposite** sides, because that bit is exactly where they
  differ;
- both copies of every repeated value land on the **same** side, because they are
  equal.

So each side holds one lonely value and some number of complete pairs — which is
`the-lonely-number` twice. Exclusive-or each side, and out come `a` and `b`.

```
both = 0
for value in values: both ^= value
bit = both & -both                 # a bit where they differ
first = 0
for value in values:
    if value & bit: first ^= value
second = both ^ first              # the other one falls out
```

Two passes and three integers — `O(n)` time, `O(1)` space.

**`both ^ first` recovers the second** without a third pass, since
`a ^ b ^ a == b`.

**`x & -x` isolates the lowest set bit.** In two's complement, `-x` is `~x + 1`,
which flips everything above the lowest set bit and leaves that bit and the zeroes
below it alone — so the `and` keeps exactly one bit. It is the same borrowing
argument as `value & (value - 1)` in `count-the-ones`, read the other way.

**The sort is only a tie rule.** The two values come out in whichever order the
split produced; the statement asks for them smaller first, so one comparison at
the end.

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- **Stopping at `a ^ b`.** It is neither answer.
- **Choosing a bit that is zero in `a ^ b`.** Both lonely values land on the same
  side and one of them is lost.
- **Assuming the lowest set bit is bit 0.** It is whichever bit `x & -x` finds.
- **A frequency map.** `O(n)` space, which the constraint rules out.
