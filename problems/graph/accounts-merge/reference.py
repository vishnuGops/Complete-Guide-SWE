from typing import Dict, List, Set


class Solution:
    def mergeAccounts(self, accounts: List[List[str]]) -> List[List[str]]:
        parent = list(range(len(accounts)))

        def find(x: int) -> int:
            root = x
            while parent[root] != root:
                root = parent[root]
            while parent[x] != root:
                parent[x], x = root, parent[x]
            return root

        # address -> the first account that mentioned it.
        owner: Dict[str, int] = {}
        for index, account in enumerate(accounts):
            for address in account[1:]:
                if address in owner:
                    a, b = find(index), find(owner[address])
                    if a != b:
                        parent[b] = a
                else:
                    owner[address] = index

        grouped: Dict[int, Set[str]] = {}
        for index, account in enumerate(accounts):
            root = find(index)
            if root not in grouped:
                grouped[root] = set()
            grouped[root].update(account[1:])

        out: List[List[str]] = []
        for root, addresses in grouped.items():
            out.append([accounts[root][0]] + sorted(addresses))

        # Sorted, because a map's order differs between languages.
        out.sort(key=lambda entry: (entry[0], entry[1]))
        return out
