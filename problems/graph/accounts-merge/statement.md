Each account is a name followed by one or more addresses. Two accounts belong to
the same person exactly when they share an address; two accounts with the same
name but no shared address are different people.

Merge the accounts. Report one entry per person: the name, followed by every
address that person owns, with no repeats.

Sort each person's addresses ascending, and sort the people by name and then by
their first address.

## Input

- `accounts` — a list of lists, each `[name, address, address, …]`

## Output

A list of merged accounts, each `[name, address, …]`, in the order described.

## Constraints

- `1 <= accounts.length <= 1000`
- `2 <= accounts[i].length <= 10`
- `1 <= total addresses <= 5000`
- Names and addresses are non-empty lowercase strings, at most 20 characters.
- Every account of a person carries that person's name.

## Examples

### Example 1

Input: `accounts = [["ann", "a1", "a2"], ["ann", "a3"], ["ann", "a2", "a4"]]`

Output: `[["ann", "a1", "a2", "a4"], ["ann", "a3"]]`

The first and third accounts share `a2`, so they merge. The second shares
nothing, so it stays separate even though the name matches.

### Example 2

Input: `accounts = [["bob", "b1"], ["cat", "c1"]]`

Output: `[["bob", "b1"], ["cat", "c1"]]`

### Example 3

Input: `accounts = [["dan", "d1"], ["dan", "d1"]]`

Output: `[["dan", "d1"]]`

The same address in both, so one person, and the address is listed once.
