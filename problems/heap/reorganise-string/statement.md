Rearrange the letters of a word so that no two neighbouring letters are the same.

If that is impossible, return the empty string. Otherwise return **any**
arrangement that works — several usually do, and any of them is accepted.

## Input

- `letters` — a string of lowercase letters

## Output

Any rearrangement of `letters` with no two neighbouring letters equal, or `""`
if none exists.

## Constraints

- `1 <= letters.length <= 10^4`
- `letters` contains only lowercase English letters.

## Examples

### Example 1

Input: `letters = "aab"`

Output: `"aba"`

### Example 2

Input: `letters = "aaab"`

Output: `""`

Three `a`s among four letters cannot be separated: whatever the arrangement, two
of them end up adjacent.

### Example 3

Input: `letters = "ab"`

Output: `"ab"` — or `"ba"`, which is equally accepted.

## Notes

Example 2 generalises: an arrangement exists exactly when no letter occurs more
than `⌈n / 2⌉` times. Working out why is most of the problem.
