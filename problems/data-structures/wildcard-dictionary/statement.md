A dictionary where a search may leave letters blank. A blank is written `.` and
stands for any single letter.

## Operations

- `BlankDictionary()` — an empty dictionary
- `add(word)` — put a word in
- `matches(pattern)` — whether some word in the dictionary matches the pattern,
  where `.` matches any one letter and everything else must match exactly. The
  pattern must match the whole word, so lengths must agree.

## Input

- Construction takes no arguments.
- `add` takes a lowercase string; `matches` takes a string of lowercase letters
  and dots.

## Output

- `add` returns nothing.
- `matches` returns a boolean.

## Constraints

- `1 <= word length <= 20`
- `1 <= pattern length <= 20`
- At most 3 dots in any pattern.
- At most 2000 operations.

## Examples

### Example 1

`add("bad")`, `add("dad")`, `add("mad")`, `matches("pad")` → `false`,
`matches("bad")` → `true`, `matches(".ad")` → `true`, `matches("b..")` → `true`

### Example 2

`add("a")`, `matches(".")` → `true`

### Example 3

`add("ab")`, `matches("a")` → `false`

The lengths differ, so nothing matches.
