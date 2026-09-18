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

Input: `path = "/home//user/"`

Output: `"/home/user"`

The doubled slash is one separator, and the trailing slash goes.

### Example 2

Input: `path = "/a/./b/../../c/"`

Output: `"/c"`

`.` is dropped; the first `..` leaves `a`, and the second leaves the root.

### Example 3

Input: `path = "/../"`

Output: `"/"`

There is nothing above the root, so the result is the root itself.
