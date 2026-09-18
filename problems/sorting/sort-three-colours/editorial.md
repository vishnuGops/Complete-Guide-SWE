# Three Kinds Of Reading

## Approach

Three values means the row can be kept in three finished regions and one
unfinished one:

```
[ 0 0 0 | 1 1 | ? ? ? ? | 2 2 ]
         low   at        high
```

- everything before `low` is a 0,
- everything from `low` to `at - 1` is a 1,
- everything after `high` is a 2,
- everything from `at` to `high` is unexamined.

Look at `grades[at]`:

- **0** — swap it with `grades[low]`, then advance both `low` and `at`. The value
  arriving from `low` is a 1 (or the same element), which is already in the right
  region, so `at` may move on.
- **1** — it is already where it belongs; advance `at`.
- **2** — swap it with `grades[high]` and step `high` back. **Do not advance
  `at`**: the value that just arrived from the back has not been examined.

The loop runs while `at <= high`, and every iteration either advances `at` or
retreats `high`, so it terminates after at most `n` steps.

The two-pass alternative — count the three grades, then rewrite the row — is
`O(n)` too and is perfectly reasonable. The single pass is worth knowing because
it generalises: this is the partition step at the heart of quicksort with equal
keys, and the same three-region invariant is what makes it linear.

## Complexity

- Time: `O(n)`, one pass.
- Space: `O(1)`.

## Pitfalls

- **Advancing `at` after swapping a 2.** The classic bug. The value swapped in
  from the back is unexamined, and skipping it leaves 0s stranded in the middle.
- **Advancing `at` past `high`.** The loop condition is `at <= high`, not
  `at < n`; once `high` has retreated the tail is already finished.
- **Rebuilding the row.** `grades = sorted(grades)` rebinds a local name, and the
  caller sees nothing (the same trap as `even-odd-partition`).
