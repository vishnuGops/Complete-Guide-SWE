# Add Two Digit Chains

## Approach

Storing the digits least significant first is not an obstacle, it is the whole
convenience: addition starts at the ones column, and that is where both chains
start. One walk down both chains, carrying a single digit, is the paper
algorithm.

```
dummy = new link; tail = dummy; carry = 0
while first is not null or second is not null or carry != 0:
    total = carry
    if first  is not null: total += first.val;  first  = first.next
    if second is not null: total += second.val; second = second.next
    tail.next = new link(total % 10)
    tail = tail.next
    carry = total / 10
return dummy.next
```

Three things are doing real work.

**The loop condition has three clauses.** `carry != 0` is the one that is
forgotten, and it is what makes `[9,9] + [1]` produce a third digit rather than
`[0, 0]`.

**One chain may be longer.** Treating a missing link as a zero keeps the loop
body uniform instead of needing a second loop for the remainder.

**The dummy head**, again, so that appending the first digit is not a special
case.

The carry is always 0 or 1, because the largest column total is `9 + 9 + 1 = 19`.

Converting both chains to integers, adding, and converting back is the answer
that fails on the constraints: ten thousand digits is a number far beyond any
fixed-width type. It happens to work in Python, whose integers are unbounded, and
that is exactly the kind of accidental pass worth not relying on.

## Complexity

- Time: `O(n + m)`.
- Space: `O(max(n, m))` for the result, and `O(1)` beyond it.

## Pitfalls

- **Dropping the final carry.** The most common wrong answer here.
- **Stopping when the shorter chain ends.** The rest of the longer one still has
  to be added, carry included.
- **Converting to an integer first.** Ten thousand digits does not fit in a
  `long`, and relying on Python's big integers is a solution that does not port.
- **Building the answer most significant first.** The output uses the same
  convention as the input.
