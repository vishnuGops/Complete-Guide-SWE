A tree can be written down as text in more than one way, and a written form is
only useful if it can be read back exactly.

You are given a tree in its **pre-order** form and must return it in its
**level-order** form. Doing that means genuinely reading the first form into a
tree and writing that tree out again — the two forms are not a text
substitution of one another.

## The two forms

Both are values separated by commas, with `#` standing for a missing node.

- **Pre-order**: the node, then its whole left subtree, then its whole right
  subtree. Every absent child is written as `#`, so the form is complete: `[1,
2, 3]` is `1,2,#,#,3,#,#`.
- **Level-order**: the levels top to bottom, left to right, with `#` for a
  missing child, and trailing `#`s dropped. `[1, 2, 3]` is `1,2,3`.

The empty tree is `#` in both forms.

## Input

- `written` — a tree in pre-order form

## Output

The same tree in level-order form.

## Constraints

- `1 <= number of nodes <= 10^4`, or the tree is empty
- `-10^9 <= node value <= 10^9`
- `written` is a well-formed pre-order form of some tree.

## Examples

### Example 1

Input: `written = "1,2,#,#,3,#,#"`

Output: `"1,2,3"`

### Example 2

Input: `written = "1,2,#,3,#,#,#"`

Output: `"1,2,#,#,3"`

The 2 has no left child but does have a right one, so the `#` cannot be dropped
— only trailing ones can.

### Example 3

Input: `written = "#"`

Output: `"#"`

The empty tree.
