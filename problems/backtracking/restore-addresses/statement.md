An address is four numbers joined by dots, like `1.24.255.0`. Each number is
between `0` and `255`, and none of them is written with a leading zero — `0` is
fine, `00` and `01` are not.

The dots have been lost. Given the digits, report every address they could have
been.

The addresses may be reported in any order.

## Input

- `digits` — a string of digits

## Output

Every address the digits could spell, as a list of strings. An empty list if
there are none.

## Constraints

- `1 <= digits.length <= 20`
- `digits` contains only the characters `0` to `9`.

## Examples

### Example 1

Input: `digits = "25525511135"`

Output: `["255.255.11.135","255.255.111.35"]`

### Example 2

Input: `digits = "0000"`

Output: `["0.0.0.0"]`

Each number is a single zero; `00` would be a leading zero.

### Example 3

Input: `digits = "1111111111111"`

Output: `[]`

Thirteen digits cannot be split into four numbers of at most three digits each.
