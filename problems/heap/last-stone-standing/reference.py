import heapq
from typing import List


class Solution:
    def lastStone(self, stones: List[int]) -> int:
        # heapq is a min-heap, so the weights go in negated.
        heap = [-weight for weight in stones]
        heapq.heapify(heap)

        while len(heap) >= 2:
            heaviest = -heapq.heappop(heap)
            second = -heapq.heappop(heap)
            if heaviest != second:
                heapq.heappush(heap, -(heaviest - second))

        return -heap[0] if heap else 0
