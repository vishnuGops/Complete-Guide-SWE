from typing import List


class Solution:
    def shortestTrip(self, distance: List[List[int]]) -> int:
        n = len(distance)
        if n == 1:
            return 0

        unreachable = 10**9
        full = 1 << n
        # best[visited][at]: the cheapest way to have visited that set and be
        # standing in `at`. The order of the visits does not matter.
        best = [[unreachable] * n for _ in range(full)]
        best[1][0] = 0

        for visited in range(full):
            if not visited & 1:
                continue
            for at in range(n):
                cost = best[visited][at]
                if cost == unreachable or not visited >> at & 1:
                    continue
                for nxt in range(n):
                    if visited >> nxt & 1:
                        continue
                    onwards = visited | 1 << nxt
                    if cost + distance[at][nxt] < best[onwards][nxt]:
                        best[onwards][nxt] = cost + distance[at][nxt]

        everywhere = full - 1
        return min(best[everywhere][at] + distance[at][0] for at in range(n))
