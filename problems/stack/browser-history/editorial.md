# Back, Forward, Visit

## Approach

Two models, and it is worth seeing both.

**Two stacks.** One holds the pages behind the current one, one the pages ahead.
`back(k)` moves up to `k` pages from behind to ahead; `forward(k)` moves them the
other way; `visit` pushes the current page onto behind and clears ahead. This is
the model the browser's own UI suggests, and "clear ahead" is a single operation.

**A list and a cursor.** Keep every page in one list and an index for the page
being shown. Then:

```
visit(url):   drop everything after the cursor; append url; cursor += 1
back(k):      cursor = max(0, cursor - k);            return pages[cursor]
forward(k):   cursor = min(len(pages) - 1, cursor + k); return pages[cursor]
```

Three lines, and the two clamps are where the "stops at whichever end it
reaches" rule lives — no bounds checking, no special cases, no error to report.

The list model is better here because `back(k)` is `O(1)` rather than `O(k)`, and
because the truncation in `visit` states the rule directly. The stack model is
better when the history must be unbounded in one direction and cheap to trim in
the other. Both are `O(1)` amortised per operation; the truncation in `visit` is
`O(discarded)`, and each page is discarded at most once.

## Complexity

- Time: `O(1)` amortised per operation.
- Space: `O(n)` in the number of pages visited.

## Pitfalls

- **Not discarding the forward history on `visit`.** The rule that makes this
  more than a list, and the one Example 2 exists for.
- **Failing when `steps` exceeds the history.** Both directions clamp.
- **Off by one on the cursor.** The home page is a real entry at index 0, not a
  special case before the list starts.
- **Returning the page you moved *from*.** Both `back` and `forward` return the
  page now shown.
