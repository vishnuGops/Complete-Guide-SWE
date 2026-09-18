# Set Bits Up To N

## Approach

Counting each number's bits separately is `O(n log n)` and perfectly fine at
`n = 10^5`. The point of the problem is that the answers are related, so each
one costs a single step.

**Two recurrences, both one line.**

- **Clear the lowest set bit.** `i & (i - 1)` is `i` with one bit removed, and it
  is smaller than `i`, so its answer is already computed:

  ```
  answer[i] = answer[i & (i - 1)] + 1
  ```

- **Halve.** The bits of `i` are the bits of `i >> 1` plus its own lowest bit:

  ```
  answer[i] = answer[i >> 1] + (i & 1)
  ```

Either fills the table in `O(n)` — one array read and one addition per number —
and both rest on the same observation: a number's bit count is reachable from a
*smaller* number's, which is what makes a single forward pass possible.

This is a one-dimensional table like `stair-ways`, with the difference that the
subproblem is not `i - 1` but a number reached by a bit operation. Recognising
"which smaller instance is this one built from" is the transferable part; it is
rarely the immediately preceding index.

**The output counts as the answer, not as working space**, which is why the space
is `O(1)` beyond it.

## Complexity

- Time: `O(n)`.
- Space: `O(1)` beyond the output.

## Pitfalls

- **Forgetting that the answer has `n + 1` entries.** It includes 0 and `n`.
- **`i >> 1` on a negative number.** Not possible here, and the trap next door.
- **Recomputing each count from scratch.** Correct, and it throws away the
  relationship the problem is about.
