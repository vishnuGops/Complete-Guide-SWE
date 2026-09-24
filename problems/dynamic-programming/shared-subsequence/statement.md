A _reading_ of a word is what is left after deleting some of its letters, keeping
the rest in order. `pat` is a reading of `plant`.

Report the length of the longest reading that both words share.

## Input

- `first` — a string of lowercase letters
- `second` — a string of lowercase letters

## Output

The length of the longest sequence that is a reading of both.

## Constraints

- `1 <= first.length <= 1000`
- `1 <= second.length <= 1000`
- Both strings are lowercase.

## Examples

### Example 1

Input: `first = "kitchen"`, `second = "thin"`

Output: `3`

`thn`. The whole of `thin` is not shared: its `i` comes after the `t`, and in
`kitchen` it comes before.

### Example 2

Input: `first = "loop"`, `second = "loop"`

Output: `4`

### Example 3

Input: `first = "cat"`, `second = "dog"`

Output: `0`

Nothing is shared.

## Notes

Trying every reading of the first word against the second is `2^n` readings. The
table below is `O(n · m)` — a million cells at the stated maximum, which is
nothing.
