Parcels wait on a belt in a fixed order and must be loaded onto lorries over at
most `days` days. Each day one lorry takes the next run of parcels from the front
of the belt, and the parcels it takes must weigh no more than the lorry's
capacity. Every lorry that day has the same capacity, and the order of the
parcels may not change.

Return the smallest capacity that gets every parcel away within `days` days.

## Input

- `weights` - a list of positive integers, the parcel weights in belt order
- `days` - the number of days available

## Output

The smallest capacity that suffices.

## Constraints

- `1 <= weights.length <= 4000`
- `1 <= weights[i] <= 10000`
- `1 <= days <= weights.length`
- A capacity below the heaviest single parcel can never work, and a capacity of
  the whole belt's weight always works in one day.

## Examples

### Example 1

Input: `weights = [1, 2, 3, 4, 5]`, `days = 2`

Output: `9`

With capacity 9 the days are `1 2 3` and `4 5`. Capacity 8 forces three days.

### Example 2

Input: `weights = [7]`, `days = 1`

Output: `7`

One parcel, one day, so the capacity is the parcel.

### Example 3

Input: `weights = [3, 3, 3]`, `days = 3`

Output: `3`

Three days for three parcels means one parcel each, and the capacity only has to
cover the heaviest of them.
