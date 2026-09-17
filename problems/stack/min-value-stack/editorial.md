## Approach

The tempting first answer — keep a single `minimum` field, updated on push — is
wrong, and it is wrong in an instructive way. It handles `push` fine. It cannot
handle `pop`: once the element holding the minimum leaves, the field has no idea
what the _next_ smallest value is, and recovering it means scanning.

So the history has to be kept, not just the current answer. Because the stack is
last-in-first-out, the history is itself a stack.

Maintain a second stack whose top is always the smallest value among the elements
currently stored. On `push(value)`, push `min(value, previous top)` onto it. On
`pop()`, pop both. The two stacks always have the same height, so the auxiliary
top corresponds exactly to the current contents.

```
push(3)   values [3]        mins [3]
push(1)   values [3, 1]     mins [3, 1]
smallest()                            -> 1
pop()     values [3]        mins [3]  -> 1
smallest()                            -> 3
```

Every operation is a constant number of list appends and removals.

## Complexity

- Time: `O(1)` per operation, worst case, not amortised.
- Space: `O(n)` — the auxiliary stack is the same height as the main one.

## Pitfalls

- **A single `minimum` variable.** It cannot survive the pop that removes the
  minimum. This is the mistake the problem exists to provoke.
- **Storing only strict improvements.** A common optimisation pushes onto the min
  stack only when `value < top`, which halves memory on some inputs — but then
  `pop` must compare before popping the min stack, and with duplicates
  (`push(5); push(5); pop()`) using `<` instead of `<=` drops the record of a
  value that is still in the stack. If you take that route, use `<=`.
- **Java `Stack`.** It is synchronised and long-deprecated in practice. Use
  `ArrayDeque`, as the reference does.
- **`Deque.peek()` returning `Integer`.** Unboxing a `null` from an empty deque
  throws `NullPointerException` rather than reporting an empty stack. The
  constraints rule that call out, but it is worth knowing where the exception
  comes from.

## Why the naive approach is not enough

Scanning the stack inside `smallest()` is `O(n)` per call. With `10^4` calls, a
sequence that pushes half of them and then queries the other half is around
`2.5 * 10^7` element reads — survivable here, but it fails the stated `O(1)`
requirement, and the requirement is the point. An interviewer asking this problem
is asking for the auxiliary stack.
