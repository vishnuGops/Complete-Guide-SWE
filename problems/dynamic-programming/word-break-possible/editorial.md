# Can It Be Read At All

## Approach

One boolean per position: `reachable[i]` means "the first `i` letters can be read
as whole words".

```
reachable[0] = true                      # no letters, no words
for i in 1 .. n:
    for j in 0 .. i-1:
        if reachable[j] and letters[j..i] is a word:
            reachable[i] = true; break
return reachable[n]
```

`reachable[0] = true` is the base case, and it is the same "one way to do
nothing" that `stair-ways` and `coin-ways` need.

**Two bounds worth adding.** The inner loop need not go back further than the
longest dictionary word — anything longer cannot be a word — which turns
`O(n²)` substring tests into `O(n · L)`. And the dictionary belongs in a hash
set, so each test is `O(word length)` rather than a scan.

**Against `word-break-all`.** That problem asks for the readings and there can be
exponentially many, so no table makes it polynomial. This one asks only whether
one exists, and a boolean per position answers it — the table never branches,
because `true` is `true` however many ways it was reached. Same recurrence, and
the difference between "does one exist" and "list them all" is the difference
between polynomial and not.

**The memoised recursion** is the same thing top-down: `canRead(i)` remembered
per `i`. Identical work, and the shape people usually find first.

## Complexity

- Time: `O(n · L)` where `L` is the longest word, plus the cost of building the
  set.
- Space: `O(n)`.

## Pitfalls

- **No memoisation.** The plain recursion is exponential on letters that almost
  work — `"aaaa…ab"` with `a` and `aa`.
- **`reachable[0] = false`.** Nothing is ever reachable.
- **Scanning the dictionary for each span.** A set makes it a look-up.
- **Greedily taking the longest word that fits.** `"catsandog"` would take `cats`
  and stop; the answer needs both branches considered.
