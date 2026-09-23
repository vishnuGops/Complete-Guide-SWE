# Expand The Shorthand

## Approach

Everything hinges on what a `]` has to do: repeat _the text built since the
matching `[`_, and then append the result to whatever was being built before
that. Both of those — "the text since" and "whatever was before" — are
last-in-first-out, which makes this two stacks and one pass.

```
counts  = empty stack
texts   = empty stack
current = empty text
count   = 0

for ch in shorthand:
    if ch is a digit:   count = count * 10 + digit(ch)
    elif ch == '[':     counts.push(count); count = 0
                        texts.push(current); current = empty
    elif ch == ']':     repeated = current * counts.pop()
                        current  = texts.pop() + repeated
    else:               current += ch

return current
```

Three details that decide whether it works:

- **Counts can be multi-digit.** `12[a]` is twelve `a`s; accumulating with
  `count * 10 + digit` and only consuming it at the `[` handles that without
  lookahead.
- **Reset `count` to 0 at the `[`.** Otherwise `2[a]3[b]` carries the 2 into the 3.
- **The text stack holds the _prefix_, not the result.** At a `]` the answer is
  the popped prefix followed by the repeated run, in that order.

Recursion is the other natural answer and is the same algorithm: the call stack
replaces the two explicit ones.

## Complexity

- Time: `O(L)` where `L` is the length of the answer — each character of the
  output is written once.
- Space: `O(L)`.

## Pitfalls

- **Reading only one digit of the count.**
- **Joining in the wrong order at `]`.** Prefix first, then the repeated run.
- **Building the result by repeated string concatenation in a loop.** In Java
  that is quadratic; use a `StringBuilder`, and stack those.
- **Assuming the answer is short because the input is.** A hundred characters of
  shorthand can expand to a hundred thousand.
