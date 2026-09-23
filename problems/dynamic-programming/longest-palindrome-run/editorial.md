# Longest Palindrome Inside

## Approach

**Two answers, and the second is better.**

**The table.** `isPalindrome[i][j]` is true when `word[i..j]` reads the same both
ways, and

```
isPalindrome[i][j] = word[i] == word[j] and (j - i < 2 or isPalindrome[i+1][j-1])
```

Filled by increasing length — so the inside is known before the outside is asked
about — this is `O(n²)` time and `O(n²)` space, and it is the two-dimensional
shape this topic is about. It is also what `split-into-palindromes` would
precompute to make each of its checks constant.

**Expanding around centres.** Every palindrome has a centre, and there are only
`2n - 1` of them: one on each letter (odd lengths) and one between each pair
(even lengths). From each, walk outwards while the two sides match:

```
for centre in 0 .. 2n-2:
    left  = centre / 2
    right = left + centre % 2
    while left >= 0 and right < n and word[left] == word[right]:
        record if longer than the best so far
        left -= 1; right += 1
```

Same `O(n²)` worst case — a string of one repeated letter — and `O(1)` space,
with no table at all. The insight it rests on is the same one: a palindrome is
its centre plus matching pairs outwards.

**Forgetting the even centres** is the classic bug, and `"cbbd"` is there to
catch it: a solution that only expands from letters finds `"b"` and never
`"bb"`.

**The tie rule needs `>` rather than `>=`.** Centres are visited left to right,
so the first run of a given length is the earliest one; replacing only on a
strictly longer run keeps it.

Manacher's algorithm answers the same question in `O(n)` by reusing what earlier
centres already proved. It is worth knowing exists, and at `n = 1000` the
quadratic walk is a millisecond.

## Complexity

- Time: `O(n²)`.
- Space: `O(1)` for the centre walk, `O(n²)` for the table.

## Pitfalls

- **Only odd centres.** `"cbbd"` comes back as a single letter.
- **`>=` on the length.** The last longest run is reported rather than the first.
- **Checking every substring from scratch.** `O(n³)`, which is a billion
  character comparisons at `n = 1000`.
- **Confusing this with the longest palindromic _subsequence_.** That one allows
  gaps and is a different table entirely.
