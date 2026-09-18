Two series of readings are each already sorted from smallest to largest. Report
the median of all the readings taken together.

The median of an odd number of readings is the middle one; for an even number it
is the average of the two middle ones.

At least one of the two series is non-empty.

## Input

- `first` — a list of integers, sorted ascending
- `second` — a list of integers, sorted ascending

## Output

The median of the two series combined. Answers within `10^-6` are accepted.

## Constraints

- `0 <= first.length <= 10^4`
- `0 <= second.length <= 10^4`
- `1 <= first.length + second.length`
- `-10^6 <= first[i], second[i] <= 10^6`
- Both series are sorted ascending and may contain duplicates.

## Examples

### Example 1

Input: `first = [1, 3]`, `second = [2]`

Output: `2`

Together they are `[1, 2, 3]`, whose middle reading is 2.

### Example 2

Input: `first = [1, 2]`, `second = [3, 4]`

Output: `2.5`

Together they are `[1, 2, 3, 4]`; the two middle readings average to 2.5.

### Example 3

Input: `first = []`, `second = [7]`

Output: `7`

One series may be empty.

## Notes

Merging the two series is `O(n + m)` and is a perfectly good answer. The target
here is `O(log(min(n, m)))`, which never looks at most of the readings at all —
and the interesting part is how you know the answer without having seen them.
