# A Queue Made Of Stacks

## Approach

A stack hands values back in reverse. Two stacks, with the contents of one poured
into the other, hand them back in reverse of reverse — which is the order they
arrived in.

So: an **incoming** stack that `push` writes to, and an **outgoing** stack that
`pop` and `peek` read from. When `pop` or `peek` finds the outgoing stack empty,
it pours the entire incoming stack across, one value at a time. The value that
arrived first ends up on top.

```
push(v):      incoming.push(v)
transfer():   if outgoing is empty: while incoming not empty: outgoing.push(incoming.pop())
pop():        transfer(); return outgoing.pop()  (or -1)
peek():       transfer(); return outgoing.top()  (or -1)
empty():      both are empty
```

**Why amortised `O(1)`.** A single `pop` can move `n` values and cost `O(n)`. But
each value is moved across exactly once in its lifetime — pushed onto incoming,
popped off it, pushed onto outgoing, popped off it: four operations, ever. So `n`
calls cost `O(n)` in total, and the average is constant even though one call is
not. That is what "amortised" means, and this is the cleanest example of it.

**Why only when outgoing is empty.** Pouring while values remain on the outgoing
stack would put newer values on top of older ones, and the order would be wrong
from then on. The emptiness check is not an optimisation; it is the invariant.

## Complexity

- Time: amortised `O(1)` per operation; `O(n)` worst case for a single `pop`.
- Space: `O(n)`.

## Pitfalls

- **Pouring on every push.** That makes `push` `O(n)` and the total `O(n^2)` —
  correct, and not what was asked.
- **Pouring when the outgoing stack is not empty.** Wrong order, and the bug
  shows up only when pushes and pops are interleaved.
- **`empty` checking one stack.** Values can be sitting on either.
- **Forgetting the empty case in `pop`/`peek`.** After pouring, the outgoing
  stack may still be empty.
