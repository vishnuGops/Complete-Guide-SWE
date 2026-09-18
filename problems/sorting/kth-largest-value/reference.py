import heapq
from typing import List


class Solution:
    def kthLargest(self, readings: List[int], k: int) -> int:
        # A min-heap holding the k largest readings seen so far; its root is
        # therefore the k-th largest.
        heap: List[int] = []
        for value in readings:
            if len(heap) < k:
                heapq.heappush(heap, value)
            elif value > heap[0]:
                heapq.heapreplace(heap, value)
        return heap[0]
