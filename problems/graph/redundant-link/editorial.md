# The Link That Closes A Loop

## Approach

Install the links in order and ask, of each one, whether its two ends are already
joined. The first link for which the answer is yes is the link that closed the
loop — and because there is exactly one loop, it is also the only such link, so
"first found" and "installed last" are the same link here.

**Union find** answers both questions in effectively constant time:

- `find(x)` — which group is `x` in?
- `union(a, b)` — join the two groups.

```
for [a, b] in links:
    if find(a) == find(b): return [a, b]
    union(a, b)
```

Two optimisations turn it from `O(n)` per operation into effectively `O(1)`, and
both are one line:

- **Path compression** — after `find` walks up to the root, point every node it
  passed straight at the root.
- **Union by size** — attach the smaller group to the larger one, so the trees
  stay shallow.

Together they give `O(α(n))` amortised, where `α` is the inverse Ackermann
function and is at most 4 for any `n` that fits in this universe.

**The alternative** is a traversal per link: before installing link `[a, b]`,
check whether `b` is already reachable from `a`. That is correct and `O(n)` per
link, so `O(n^2)` overall — fine at these sizes and the wrong instinct to build,
because the whole point of union find is that connectivity questions asked
*incrementally* do not need a traversal each time.

## Complexity

- Time: `O(n · α(n))`.
- Space: `O(n)`.

## Pitfalls

- **Returning the last link in the list.** It is often the answer and it is not
  the rule.
- **Union find without either optimisation.** It degrades to a linked list, and
  `find` becomes `O(n)`.
- **Uniting before checking.** The check has to happen first, or every link finds
  its ends joined.
- **Recording the answer and continuing.** With exactly one loop there is exactly
  one such link, so returning at once is correct.
