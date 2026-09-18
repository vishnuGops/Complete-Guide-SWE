# Connections, As They Come

## Approach

The question is connectivity, and the thing that makes it interesting is that it
is asked **between** the connections rather than after all of them. A traversal
answers each question in `O(n)`; union find answers it in effectively `O(1)`
because it never traverses anything.

Each machine points at another machine in its group; following the pointers ends
at the group's **representative**, which points at itself.

- **`find(x)`** — follow the pointers to the representative.
- **`joined(a, b)`** — `find(a) == find(b)`.
- **`link(a, b)`** — find both representatives; if they are the same, nothing
  happens and the answer is `false`; otherwise point one at the other, decrement
  the group count, and add the sizes.
- **`groups()`** — a counter that starts at `n` and drops by one per successful
  link.
- **`sizeOf(a)`** — the size recorded at `find(a)`.

**The two optimisations are what make it fast, and each is one line.**

*Union by size*: always attach the smaller group's representative under the
larger one's. Without it, `link(0,1), link(0,2), link(0,3), …` can build a chain
`n` long and every `find` walks all of it.

*Path compression*: after a `find`, point every machine it walked past straight
at the representative, so the next `find` from any of them is one step.

Together they give `O(α(n))` amortised per operation, where `α` is the inverse
Ackermann function — at most 4 for any `n` that will ever be stored. Calling it
"effectively constant" is honest; calling it constant is not.

**What union find cannot do** is un-link. Splitting a group would require knowing
which machines came from where, and the pointers deliberately forget that. A
problem that removes connections needs a different structure entirely.

## Complexity

- Time: `O(α(n))` amortised per operation.
- Space: `O(n)`.

## Pitfalls

- **Storing the group number directly.** `joined` is then instant and `link` is
  `O(n)`, which is the wrong trade for a stream of links.
- **Leaving out union by size.** A chain, and `find` becomes `O(n)`.
- **Writing `find` recursively.** The chain it walks can be long before
  compression kicks in.
- **Counting groups by scanning for representatives.** That is `O(n)` per call
  for something a counter tracks in `O(1)`.
