# Every Subset

## Approach

A subset is a yes-or-no decision per value, so the recursion is two branches
deep at each of `n` levels:

```
build(at, chosen):
    if at == n:
        record a copy of chosen
        return
    build(at + 1, chosen)                 # leave values[at] out
    chosen.append(values[at])
    build(at + 1, chosen)                 # take it
    chosen.pop()                          # undo, on the way back up
```

Two things carry it, and they are the two things every backtracking problem
carries.

**The undo.** One working list is reused for every subset, appended to before a
branch and popped after it, so its contents always describe the current partial
choice exactly. That is what keeps the working memory `O(n)` rather than `O(2^n)`.

**The copy.** Recording the working list itself stores a reference to something
the recursion keeps changing; by the time the answer is read it describes some
other subset. Copy it at the moment it is recorded.

There are `2^n` subsets and each costs `O(n)` to copy, so `O(n · 2^n)` is the
floor — the output alone is that large, which is why `n` is capped at 12.

`subsets-by-mask` builds the same answer without any recursion at all, by
reading the bits of `0 .. 2^n - 1`; the two are worth writing side by side.

## Complexity

- Time: `O(n · 2^n)`.
- Space: `O(n)` besides the answer.

## Pitfalls

- **Recording the working list without copying it.** Every subset comes out
  equal, and usually empty.
- **Forgetting to pop.** The subsets grow monotonically.
- **Leaving out the empty subset or the whole set.** Both are subsets.
- **Assuming an order is required.** Neither the outer nor the inner order
  matters here.
