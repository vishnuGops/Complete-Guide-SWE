from typing import List


class Solution:
    def canReach(self, n: int, roads: List[List[int]], start: int, finish: int) -> bool:
        if start == finish:
            return True

        neighbours: List[List[int]] = [[] for _ in range(n)]
        for a, b in roads:
            neighbours[a].append(b)
            neighbours[b].append(a)

        seen = [False] * n
        seen[start] = True
        stack = [start]

        while stack:
            place = stack.pop()
            for other in neighbours[place]:
                if other == finish:
                    return True
                if not seen[other]:
                    # Marked when pushed, so a place is walked once.
                    seen[other] = True
                    stack.append(other)

        return False
