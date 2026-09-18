Two words are built from the same letters when each one can be rearranged into
the other: the same letters, each used the same number of times.

Report whether `first` and `second` are built from the same letters.

## Input

- `first` — a string of lowercase letters
- `second` — a string of lowercase letters

## Output

`true` if the two words use exactly the same letters the same number of times,
`false` otherwise.

## Constraints

- `1 <= first.length <= 10^4`
- `1 <= second.length <= 10^4`
- Both strings contain only lowercase English letters.

## Examples

### Example 1

Input: `first = "listen"`, `second = "silent"`

Output: `true`

Both words use `e`, `i`, `l`, `n`, `s` and `t` once each.

### Example 2

Input: `first = "apple"`, `second = "aplet"`

Output: `false`

They are the same length and share four letters, but `apple` has two `p`s and
`aplet` has one, plus a `t` that `apple` does not have.

### Example 3

Input: `first = "aab"`, `second = "ab"`

Output: `false`

Different lengths can never match, however many letters they share.
