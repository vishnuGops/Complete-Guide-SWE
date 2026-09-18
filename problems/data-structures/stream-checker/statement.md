Letters arrive one at a time and never stop. After each one, report whether the
letters seen so far **end with** one of a fixed list of words.

## Operations

- `StreamChecker(words)` — the words to watch for
- `next(letter)` — record one letter and report whether the stream now ends with
  one of the words

## Input

- Construction takes a list of lowercase strings.
- `next` takes a one-character lowercase string.

## Output

- `next` returns a boolean.

## Constraints

- `1 <= words.length <= 200`
- `1 <= word length <= 20`
- At most 4000 calls to `next`.
- All strings are lowercase English letters.

## Examples

### Example 1

`StreamChecker(["cd","f","kl"])`, then the letters `a b c d e f g h i j k l`:

`false false false true false true false false false false false true`

After `d` the stream ends with `cd`; after `f` it ends with `f`; after `l` it
ends with `kl`.

### Example 2

`StreamChecker(["a"])`, then `b`, `a`:

`false true`

### Example 3

`StreamChecker(["ab"])`, then `a`:

`false`

Only half of the word has arrived.
