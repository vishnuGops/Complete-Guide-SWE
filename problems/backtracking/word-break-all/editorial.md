# Every Way To Read It

## Approach

Ask the question **per position**: what are all the readings of the letters from
position `i` onwards?

```
readings(i):
    if i == letters.length: return [""]        # one reading: the empty one
    out = []
    for word in dictionary:
        if letters starts with word at i:
            for rest in readings(i + word.length):
                out.append(rest.isEmpty() ? word : word + " " + rest)
    return out
```

**The answer depends only on `i`**, not on how the search arrived there — which
is exactly the condition that makes memoisation apply. Remember `readings(i)` the
first time it is computed and the whole thing becomes linear in the number of
positions rather than exponential in the number of paths to them.

**Why it matters, concretely.** Take twenty `a`s followed by a `b`, with `a` and
`aa` in the dictionary. Every prefix splits in a Fibonacci number of ways — about
ten thousand at position 20 — and *none* of them leads anywhere, because nothing
spells the `b`. Without memoisation the search discovers that separately for
every path. With it, position 20 is computed once, comes back empty, and
everything above it collapses at once.

**Memoisation does not make the output small.** When there really are many
readings, there really are many readings — `a` and `aa` over twenty `a`s give
over ten thousand sentences — and they all have to be built. What memoisation
removes is the *wasted* work, which is the part that is exponential for no
reason.

**The base case returns one empty reading, not none.** `[""]` means "there is one
way to read nothing"; `[]` would mean "there is no way", and the whole answer
would collapse to nothing.

The yes-or-no version of this question — `word-break-possible` — needs only a
boolean per position and is `O(n² · dictionary)` with no exponential anywhere,
because it never builds the readings.

## Complexity

- Time: `O(n² · dictionary)` to fill the table, plus the size of the output.
- Space: `O(n²)` for the memo in the worst case.

## Pitfalls

- **No memoisation.** Correct, and exponential on the almost-works inputs.
- **Returning `[]` at the end of the letters.** Everything collapses to nothing.
- **Memoising the *sentence* rather than the readings of a suffix.** The prefix
  is not part of the subproblem, and including it makes every entry unique.
- **Joining with a trailing space.** The words are separated, not terminated.
