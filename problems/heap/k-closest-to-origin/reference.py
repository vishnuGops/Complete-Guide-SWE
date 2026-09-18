import heapq
from typing import List


class Solution:
    def nearestPoints(self, points: List[List[int]], k: int) -> List[List[int]]:
        # A max-heap of the k best so far: negated, because heapq is a min-heap,
        # so its root is the worst point kept and the one to give up.
        heap: List = []
        for x, y in points:
            key = (-(x * x + y * y), -x, -y)
            if len(heap) < k:
                heapq.heappush(heap, key)
            elif key > heap[0]:
                heapq.heapreplace(heap, key)

        best = sorted(heap, reverse=True)
        return [[-entry[1], -entry[2]] for entry in best]
