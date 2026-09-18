A pattern is made of lowercase letters and two special characters:

- `.` matches any single letter;
- `*` follows a letter or a `.`, and means "zero or more of the thing before it".

The pattern must match the **whole** text, not a part of it.

Report whether it does.

## Input

- `text` — a string of lowercase letters
- `pattern` — a string of lowercase letters, `.` and `*`

## Output

`true` if the pattern matches the whole text, `false` otherwise.

## Constraints

- `0 <= text.length <= 20`
- `1 <= pattern.length <= 30`
- `text` is lowercase letters only.
- `pattern` is lowercase letters, `.` and `*`, and every `*` follows a letter or
  a `.`.

## Examples

### Example 1

Input: `text = "aab"`, `pattern = "c*a*b"`

Output: `true`

`c*` matches no `c`s, `a*` matches two `a`s, `b` matches the `b`.

### Example 2

Input: `text = "ab"`, `pattern = ".*"`

Output: `true`

`.*` matches any run of any letters.

### Example 3

Input: `text = "aa"`, `pattern = "a"`

Output: `false`

The pattern must match all of the text.
