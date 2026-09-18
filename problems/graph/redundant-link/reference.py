from typing import List


class Solution:
    def closingLink(self, n: int, links: List[List[int]]) -> List[int]:
        parent = list(range(n))
        size = [1] * n

        def find(x: int) -> int:
            # Path compression, written as a loop so a long chain costs no stack.
            root = x
            while parent[root] != root:
                root = parent[root]
            while parent[x] != root:
                parent[x], x = root, parent[x]
            return root

        for a, b in links:
            root_a = find(a)
            root_b = find(b)
            if root_a == root_b:
                return [a, b]
            # Union by size, so the trees stay shallow.
            if size[root_a] < size[root_b]:
                root_a, root_b = root_b, root_a
            parent[root_b] = root_a
            size[root_a] += size[root_b]

        return []
