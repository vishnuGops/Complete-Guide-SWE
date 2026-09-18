import heapq
from typing import List, Tuple


class Solution:
    def whenAllHear(self, n: int, links: List[List[int]], source: int) -> int:
        onwards: List[List[Tuple[int, int]]] = [[] for _ in range(n)]
        for start, end, delay in links:
            onwards[start].append((end, delay))

        settled = [False] * n
        remaining = n
        last = 0
        heap: List[Tuple[int, int]] = [(0, source)]

        while heap and remaining:
            tick, machine = heapq.heappop(heap)
            if settled[machine]:
                continue
            settled[machine] = True
            remaining -= 1
            if tick > last:
                last = tick
            for other, delay in onwards[machine]:
                if not settled[other]:
                    heapq.heappush(heap, (tick + delay, other))

        return last if remaining == 0 else -1
