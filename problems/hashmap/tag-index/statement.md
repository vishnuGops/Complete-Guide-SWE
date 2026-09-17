Build an index that tracks which tag each item carries, and can say how many items
carry a given tag without counting them.

Each item carries at most one tag. Tagging an item that already has a tag
replaces it.

Support these four operations:

- `add(item, tag)` - give `item` the tag `tag`, replacing any tag it had
- `remove(item)` - forget `item` entirely; does nothing if the item is unknown
- `count(tag)` - how many items currently carry `tag`
- `tagOf(item)` - the tag `item` carries, or the empty string if it has none

Every operation must run in constant time on average. Counting the items on each
`count` call is too slow.

## Input

- Construction takes no arguments.
- `add` takes two strings, `remove` and `tagOf` take one, `count` takes one.

## Output

- `add` and `remove` return nothing.
- `count` returns an integer, `tagOf` returns a string.

## Constraints

- At most `4000` operations
- Items and tags are non-empty strings of at most 20 lowercase letters
- `count` may be asked about a tag no item has ever carried, and must answer `0`

## Examples

### Example 1

Operations: `add("doc", "red")`, `add("img", "red")`, `count("red")`
Output: `[null, null, 2]`

Both items carry `red`, so the count is 2.

### Example 2

Operations: `add("doc", "red")`, `add("doc", "blue")`, `count("red")`, `count("blue")`
Output: `[null, null, 0, 1]`

Re-tagging `doc` moves it out of `red` and into `blue`; `red` is now empty.

### Example 3

Operations: `add("doc", "red")`, `remove("doc")`, `remove("doc")`, `tagOf("doc")`
Output: `[null, null, null, ""]`

Removing twice is not an error, and an unknown item has no tag.
