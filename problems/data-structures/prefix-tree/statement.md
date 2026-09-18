Build a dictionary that answers two different questions about the words it holds:
whether a word is in it, and whether any word in it starts with a given prefix.

## Operations

- `PrefixTree()` — an empty dictionary
- `add(word)` — put a word in; adding the same word twice changes nothing
- `has(word)` — whether that exact word is in the dictionary
- `startsWith(prefix)` — whether some word in the dictionary begins with
  `prefix`

## Input

- Construction takes no arguments.
- `add`, `has` and `startsWith` each take one lowercase string.

## Output

- `add` returns nothing.
- `has` and `startsWith` return a boolean.

## Constraints

- `1 <= word length <= 20`
- All strings are lowercase English letters.
- At most 3000 operations.

## Examples

### Example 1

`add("apple")`, `has("apple")` → `true`, `has("app")` → `false`,
`startsWith("app")` → `true`

`app` is a prefix of a word in the dictionary but is not itself in it.

### Example 2

`startsWith("a")` → `false`

An empty dictionary starts with nothing.

### Example 3

`add("a")`, `has("a")` → `true`, `startsWith("a")` → `true`

A word is a prefix of itself.
