# Tidy The Path

## Approach

Splitting on `/` turns the path into a sequence of pieces, and each kind of piece
is one operation on the answer built so far:

| Piece         | Meaning              | Operation |
| ------------- | -------------------- | --------- |
| `""`          | a repeated separator | nothing   |
| `"."`         | this folder          | nothing   |
| `".."`        | the folder above     | pop       |
| anything else | a folder name        | push      |

That is a stack, and the whole solution is one pass over the pieces.

```
names = empty stack
for piece in path.split("/"):
    if piece == "" or piece == ".":   continue
    if piece == "..":                 pop if not empty
    else:                             push piece
return "/" + "/".join(names)
```

Rebuilding is where the edge cases disappear rather than needing handling: an
empty stack joins to the empty string, and prefixing `/` gives `"/"` — the root,
which is exactly right. A non-empty stack gets a single leading slash and single
separators with no trailing one, also by construction.

Two readings that trip people:

- **`..` at the root pops nothing.** It is not an error and it is not kept.
- **`...` is a name.** So is `....`, and so is `_`. Only exactly `.` and exactly
  `..` are special, which is why the comparison is on the whole piece rather than
  on a prefix.

## Complexity

- Time: `O(n)`.
- Space: `O(n)`.

## Pitfalls

- **Trimming characters instead of splitting.** Removing `/./` textually misses
  `/a/./.` and mangles names containing dots.
- **Treating any piece that starts with `.` as special.** `...` is a folder.
- **Forgetting the empty result.** An empty stack must produce `"/"`, not `""`.
- **Leaving a trailing slash.** Joining and then prefixing gives the right shape;
  appending a slash per name does not.
