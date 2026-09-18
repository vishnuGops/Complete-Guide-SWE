Given a long `log` of letters and a short string of letters you `need`, find the
shortest unbroken stretch of the log that contains every needed letter, counting
repeats.

If `need` asks for three `a`s, the stretch must hold at least three `a`s. Letters
the stretch contains but does not need are fine — they just make it longer.

If several shortest stretches tie, return the one that starts earliest. If no
stretch covers the need, return the empty string.

## Input

- `log` — a string of lowercase letters
- `need` — a string of lowercase letters

## Output

The shortest covering stretch of `log`, or `""` if there is none.

## Constraints

- `1 <= log.length <= 10^4`
- `1 <= need.length <= 100`
- Both strings contain only lowercase English letters.

## Examples

### Example 1

Input: `log = "adobecodebanc"`, `need = "abc"`

Output: `"banc"`

`"adobec"` covers the need too, but it is six letters long; `"banc"` is four and
nothing shorter works.

### Example 2

Input: `log = "aa"`, `need = "aa"`

Output: `"aa"`

Repeats count: one `a` is not enough, so the answer is the whole log.

### Example 3

Input: `log = "abc"`, `need = "abcd"`

Output: `""`

The log never contains a `d`, so nothing covers the need.

## Notes

Checking every stretch is `O(n^2)` stretches before you even count the letters
in one. At the stated maximum that will not finish. Aim for a single pass in
which each end of the stretch only ever moves forward.
