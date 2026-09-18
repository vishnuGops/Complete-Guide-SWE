As somebody types, suggest the words that could complete what they have written.

## Operations

- `Suggester()` — an empty dictionary
- `add(word)` — put a word in; adding the same word twice changes nothing
- `suggest(prefix)` — up to three words beginning with `prefix`, in alphabetical
  order; fewer if fewer exist, and an empty list if none do

## Input

- Construction takes no arguments.
- `add` and `suggest` each take one lowercase string.

## Output

- `add` returns nothing.
- `suggest` returns a list of strings.

## Constraints

- `1 <= word length <= 20`
- `1 <= prefix length <= 20`
- All strings are lowercase English letters.
- At most 2000 operations.

## Examples

### Example 1

`add("mouse")`, `add("mousepad")`, `add("mobile")`, `suggest("mo")` →
`["mobile","mouse","mousepad"]`

All three begin with `mo`, in alphabetical order.

### Example 2

`add("mouse")`, `add("mousepad")`, `add("mobile")`, `add("moon")`,
`suggest("mo")` → `["mobile","moon","mouse"]`

Four words match and only the first three alphabetically are reported.

### Example 3

`suggest("z")` → `[]`

Nothing matches.
