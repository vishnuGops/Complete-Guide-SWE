import heapq
from typing import Dict, List


class Solution:
    def mostCommon(self, readings: List[int], k: int) -> List[int]:
        counts: Dict[int, int] = {}
        for value in readings:
            counts[value] = counts.get(value, 0) + 1

        # A min-heap of the k best entries so far, ordered by the rule reversed:
        # the weakest entry is the one to drop.
        heap: List = []
        for value, count in counts.items():
            # (count, -value) compares the way the answer is ordered, backwards.
            entry = (count, -value)
            if len(heap) < k:
                heapq.heappush(heap, entry)
            elif entry > heap[0]:
                heapq.heapreplace(heap, entry)

        best = sorted(heap, key=lambda entry: (-entry[0], -entry[1]))
        return [-entry[1] for entry in best]
