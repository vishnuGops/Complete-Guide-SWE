For each reading in a row, report the product of every _other_ reading.

Do it without division — a single zero anywhere in the row would make that
approach a special case, and two zeroes would make it useless.

## Input

- `readings` — a list of integers

## Output

A list of the same length. Position `i` holds the product of all the readings
except `readings[i]`.

## Constraints

- `2 <= readings.length <= 10^4`
- `-9 <= readings[i] <= 9`
- At most 12 readings have an absolute value of 2 or more, so every product
  involved fits comfortably in a signed 64-bit integer.
- The output does not count towards your space budget; `O(1)` means `O(1)`
  _besides_ the list you return.

## Examples

### Example 1

Input: `readings = [1, 2, 3, 4]`

Output: `[24, 12, 8, 6]`

Leaving out the 1 gives 2·3·4 = 24; leaving out the 2 gives 1·3·4 = 12, and so
on.

### Example 2

Input: `readings = [0, 4, 5]`

Output: `[20, 0, 0]`

Only the position holding the zero escapes it. Every other product includes the
zero and is therefore zero.

### Example 3

Input: `readings = [-2, 3]`

Output: `[3, -2]`

With two readings each answer is simply the other one.
