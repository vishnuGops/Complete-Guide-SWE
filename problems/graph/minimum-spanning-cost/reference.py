from typing import List


class Solution:
    def connectAll(self, n: int, cables: List[List[int]]) -> int:
        parent = list(range(n))
        size = [1] * n

        def find(x: int) -> int:
            root = x
            while parent[root] != root:
                root = parent[root]
            while parent[x] != root:
                parent[x], x = root, parent[x]
            return root

        bought = 0
        total = 0

        for a, b, price in sorted(cables, key=lambda cable: cable[2]):
            root_a = find(a)
            root_b = find(b)
            if root_a == root_b:
                # Both ends are already connected: this cable only closes a loop.
                continue
            if size[root_a] < size[root_b]:
                root_a, root_b = root_b, root_a
            parent[root_b] = root_a
            size[root_a] += size[root_b]
            total += price
            bought += 1
            if bought == n - 1:
                return total

        return total if n == 1 else -1
