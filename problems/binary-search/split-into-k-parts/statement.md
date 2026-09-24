A queue of jobs has to be handed to `k` workers. A worker takes an unbroken run
of the queue — the order may not be changed and no job may be split — and every
job goes to exactly one worker.

The batch finishes when the slowest worker finishes, so the cost of a split is
the largest total any one worker is handed. Report the smallest cost achievable.

## Input

- `loads` — a list of non-negative integers, in queue order
- `k` — how many workers the queue is split between

## Output

The smallest possible value of the largest run total, over all ways of cutting
`loads` into `k` unbroken runs.

## Constraints

- `1 <= k <= loads.length <= 10^4`
- `0 <= loads[i] <= 10^6`

## Examples

### Example 1

Input: `loads = [4, 3, 9, 2, 8]`, `k = 2`

Output: `16`

Cutting after the 9 gives `[4, 3, 9]` = 16 and `[2, 8]` = 10. Every other cut
is worse.

### Example 2

Input: `loads = [1, 2, 3, 4, 5]`, `k = 5`

Output: `5`

One job each, so the cost is the largest single job.

### Example 3

Input: `loads = [2, 9, 1, 3]`, `k = 3`

Output: `9`

The cost can never be below the largest job, 9, and `[2]`, `[9]`, `[1, 3]`
keeps every worker within it, so the largest job decides.

## Notes

The obvious answer is a table over (position, workers used), which is `O(n^2 k)`
to fill. At the stated maximum that is far beyond finishing.
