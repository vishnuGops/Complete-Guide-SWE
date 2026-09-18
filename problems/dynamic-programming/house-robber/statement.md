A row of houses each holds some amount. You may take from as many as you like,
except that **two neighbouring houses may not both be taken** — taking one sets
off the alarm next door.

Report the largest total you can take.

## Input

- `houses` — what each house holds, in a row

## Output

The largest total from a set of houses with no two neighbours.

## Constraints

- `1 <= houses.length <= 10^4`
- `0 <= houses[i] <= 400`

## Examples

### Example 1

Input: `houses = [1, 2, 3, 1]`

Output: `4`

The first and third: 1 + 3.

### Example 2

Input: `houses = [2, 7, 9, 3, 1]`

Output: `12`

The first, third and fifth: 2 + 9 + 1.

### Example 3

Input: `houses = [5]`

Output: `5`
