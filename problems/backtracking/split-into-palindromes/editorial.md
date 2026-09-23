# Cut Into Palindromes

## Approach

Decide the **first** piece, then ask the same question of the rest:

```
build(at):
    if at == word.length:
        record a copy of the pieces
        return
    for end in at+1 .. word.length:
        if word[at..end] is a palindrome:
            pieces.append(word[at..end])
            build(end)
            pieces.pop()
```

**The palindrome test is the prune, and it is the whole point.** There are
`2^(n-1)` ways to cut a word of length `n` — a cut after each of the `n-1` gaps
or not — and for most words very few of them are valid. Testing each piece
_before_ recursing abandons a branch the moment it cannot lead anywhere, so the
work is proportional to the valid prefixes rather than to all the cuttings.
Generating every cutting and filtering afterwards is correct and does the full
`2^(n-1)`.

**When it is still exponential.** A word of `n` equal letters has `2^(n-1)`
valid cuttings, because every piece of it is a palindrome. The pruning cannot
help there — the answer really is that large — which is why `n` is capped at 14.

**Testing the pieces faster.** Each palindrome test costs `O(n)`, so the whole
search is `O(n · 2^n)` in the worst case. Precomputing a table of
`isPalindrome[i][j]` for every pair of endpoints — which is
`longest-palindrome-run`'s two-dimensional table — makes each test `O(1)` at the
cost of `O(n²)` space. At `n = 14` that is not worth it; at `n = 200` it is the
difference between finishing and not.

## Complexity

- Time: `O(n · 2^n)` in the worst case.
- Space: `O(n)` besides the answer.

## Pitfalls

- **Filtering instead of pruning.** Correct and exponentially wasteful on
  ordinary words.
- **Forgetting that a single letter is a palindrome.** Every word then has no
  cutting at all.
- **Checking the palindrome after the recursion returns.** The prune has to
  happen before.
- **Recording without copying**, and **forgetting the pop**.
