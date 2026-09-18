Readings arrive one at a time and never stop. After each one, report the `k`-th
largest reading seen so far, counting duplicates separately.

The stream is guaranteed to hold at least `k` readings by the time it is first
asked, so there is always an answer.

## Operations

- `RunningKthLargest(k, first)` — start with `k` and an initial batch of readings
- `add(value)` — record a reading and return the `k`-th largest seen so far

## Input

- Construction takes an integer `k` and a list of integers.
- `add` takes an integer.

## Output

- `add` returns an integer.

## Constraints

- `1 <= k <= 10^4`
- `0 <= first.length <= 10^4`
- `-10^9 <= value <= 10^9`
- At most 10^4 calls to `add`, and at least `k` readings exist before the first
  call returns.

## Examples

### Example 1

`RunningKthLargest(3, [4, 5, 8, 2])`, `add(3)` → `4`, `add(5)` → `5`, `add(10)` →
`5`

After `add(3)` the readings are 2, 3, 4, 5, 8 and the third largest is 4.

### Example 2

`RunningKthLargest(1, [])`, `add(-1)` → `-1`, `add(-5)` → `-1`

With `k = 1` the answer is the largest reading so far.

### Example 3

`RunningKthLargest(2, [7, 7])`, `add(7)` → `7`

Duplicates count separately.
