# Does The Pattern Match

## Approach

A table over pairs of prefixes: `ok[i][j]` means "the first `i` letters of the
text are matched by the first `j` characters of the pattern".

**The ordinary case.** If `pattern[j-1]` is a letter or a `.`, it must consume
exactly one text letter:

```
ok[i][j] = ok[i-1][j-1] and (pattern[j-1] == '.' or pattern[j-1] == text[i-1])
```

**The star.** If `pattern[j-1]` is `*`, it and the character before it form one
unit with exactly two readings:

- **Zero occurrences** — skip both characters: `ok[i][j-2]`.
- **One more occurrence** — the unit has already matched some text and matches
  one letter more: `ok[i-1][j]`, provided `pattern[j-2]` matches `text[i-1]`.
  Note that `j` does not move: the star stays available to repeat again.

```
ok[i][j] = ok[i][j-2]
        or (ok[i-1][j] and (pattern[j-2] == '.' or pattern[j-2] == text[i-1]))
```

**The base row is not all false.** `ok[0][0]` is true, and `ok[0][j]` is true
whenever the pattern's first `j` characters can match nothing at all — which
means every `*` group, so `a*b*c*` matches the empty text. Getting that row wrong
is the commonest failure, and it is why `"" `against `"a*"` must be `true`.

Filled with `i` and `j` increasing, every cell reads cells already filled:
`O(n · m)` time, and `O(m)` space if only the previous row is kept.

**Why not just try it.** The recursion with no table branches at every star and
re-solves the same pairs along different paths — the `"aaaaaaaaaaaaaaaaaaaa"`
against `"a*a*a*a*a*a*a*a*a*a*"` shape is the classic demonstration, and it is
exponential. The table's whole contribution is noticing that the state is a pair
of positions and nothing else.

## Complexity

- Time: `O(n · m)`.
- Space: `O(m)`.

## Pitfalls

- **An all-false base row.** `a*` against the empty text must be true.
- **Treating `*` as "one or more".** It allows zero.
- **Matching a prefix.** The pattern must cover the whole text.
- **Advancing past the star after one repetition.** The star stays in play, which
  is what `ok[i-1][j]` expresses.
