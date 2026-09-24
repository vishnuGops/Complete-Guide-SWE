Tidy an absolute file path.

The rules are the usual ones:

- `.` means "this folder" and can be dropped.
- `..` means "the folder above"; at the root there is nothing above, so it is
  dropped too.
- Any run of slashes counts as a single separator.
- The tidy form starts with a single `/`, joins the remaining names with single
  slashes, and has no trailing slash — except the root itself, which is `/`.

Anything that is not `.`, `..` or empty is a folder name, whatever it looks like:
`...` is a perfectly ordinary name.

## Input

- `path` — an absolute path, beginning with `/`

## Output

The tidy form of the path.

## Constraints

- `1 <= path.length <= 3000`
- `path` begins with `/` and contains only English letters, digits, `.`, `/` and
  `_`.

## Examples

### Example 1

Input: `path = "/music///jazz/"`

Output: `"/music/jazz"`

The run of three slashes is one separator, and the trailing slash goes.

### Example 2

Input: `path = "/usr/local/./bin/../../lib/"`

Output: `"/usr/lib"`

`.` is dropped; the first `..` undoes `bin` and the second undoes `local`, so
`lib` goes straight under `usr`.

### Example 3

Input: `path = "/../docs"`

Output: `"/docs"`

There is nothing above the root, so the `..` is dropped and `docs` sits directly
under the root.
