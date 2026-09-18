import heapq
from typing import List, Tuple


class Solution:
    def cheapestRoute(self, n: int, roads: List[List[int]], start: int, finish: int) -> int:
        onwards: List[List[Tuple[int, int]]] = [[] for _ in range(n)]
        for source, target, toll in roads:
            onwards[source].append((target, toll))

        settled = [False] * n
        heap: List[Tuple[int, int]] = [(0, start)]

        while heap:
            paid, place = heapq.heappop(heap)
            # A stale entry: a cheaper route to this place was found later.
            if settled[place]:
                continue
            settled[place] = True
            if place == finish:
                return paid
            for target, toll in onwards[place]:
                if not settled[target]:
                    heapq.heappush(heap, (paid + toll, target))

        return -1
