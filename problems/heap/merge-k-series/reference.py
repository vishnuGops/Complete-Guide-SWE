import heapq
from typing import List


class Solution:
    def mergeSeries(self, series: List[List[int]]) -> List[int]:
        # (value, which series, how far along). The index is also the tie-break,
        # so two equal values never make Python compare two lists.
        heap = []
        for which, one in enumerate(series):
            if one:
                heapq.heappush(heap, (one[0], which, 0))

        out: List[int] = []
        while heap:
            value, which, at = heapq.heappop(heap)
            out.append(value)
            if at + 1 < len(series[which]):
                heapq.heappush(heap, (series[which][at + 1], which, at + 1))

        return out
