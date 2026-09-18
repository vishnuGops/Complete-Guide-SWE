from typing import List


class Solution:
    def countGroups(self, n: int, links: List[List[int]]) -> int:
        # The edge list cannot answer "who is next to this person"; this can.
        neighbours: List[List[int]] = [[] for _ in range(n)]
        for a, b in links:
            neighbours[a].append(b)
            neighbours[b].append(a)

        seen = [False] * n
        groups = 0

        for start in range(n):
            if seen[start]:
                continue
            groups += 1
            # An explicit stack: a chain of ten thousand is one component.
            stack = [start]
            seen[start] = True
            while stack:
                person = stack.pop()
                for other in neighbours[person]:
                    if not seen[other]:
                        seen[other] = True
                        stack.append(other)

        return groups
