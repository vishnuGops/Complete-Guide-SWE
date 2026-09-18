A message is a run of lowercase letters. Find the first letter that appears
exactly once in the whole message.

Return the index of that letter, or `-1` if every letter appears more than once.

## Input

- `text` - a string of lowercase letters (`a` to `z`), possibly empty

## Output

The index of the first letter that appears exactly once, or `-1`.

## Constraints

- `0 <= text.length <= 10000`
- `text` contains only the characters `a` to `z`
- An empty message has no such letter, so its answer is `-1`.

## Examples

### Example 1

Input: `text = "swiss"`

Output: `1`

`s` appears three times, so the first letter that stands alone is `w` at index 1.

### Example 2

Input: `text = "aabb"`

Output: `-1`

Every letter appears twice.

### Example 3

Input: `text = "z"`

Output: `0`

A single letter is by definition alone.
