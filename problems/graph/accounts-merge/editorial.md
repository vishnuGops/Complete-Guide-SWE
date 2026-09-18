# One Person, Many Addresses

## Approach

The rule is a connectivity rule: accounts are joined when they share an address,
and a person is a connected group of accounts. So the problem is
`count-components` with the grouping made explicit — except that the edges are
not given and building them by comparing every pair of accounts is `O(accounts²
· addresses)`.

**The map is what avoids that.** Walk the accounts once, keeping a map from
address to the first account that mentioned it. When an address turns up again,
join the current account to that first one. Every address is looked at once, and
each look-up yields at most one join.

```
owner = {}                          # address -> the first account that had it
for index, account in accounts:
    for address in account[1:]:
        if address in owner: union(index, owner[address])
        else:                owner[address] = index
```

Union find keeps the joins effectively constant-time, and after the pass each
group's representative identifies one person.

**Then assemble.** Collect each address under its account's representative,
de-duplicate (a set does both), sort the addresses, and put the name in front —
the name can be read from any account in the group, since every account of a
person carries it.

**The ordering rules are not decoration.** Without them the answer depends on
map iteration order, which differs between the two languages; with them there is
exactly one correct output. Sorting inside each person and then sorting the
people by `(name, first address)` is the whole of it.

Breadth-first search over the same implicit graph works too: the map is still
needed to find neighbours, and only the joining mechanism changes.

## Complexity

- Time: `O(A log A)` in the total number of addresses, dominated by the sorting.
- Space: `O(A)`.

## Pitfalls

- **Merging by name.** Two people can share a name; only a shared address merges.
- **Comparing every pair of accounts.** Quadratic, and unnecessary.
- **Forgetting to de-duplicate.** The same address can appear in several accounts
  of the same person.
- **Leaving the output in map order.** It differs by language, so the answer must
  be sorted.
