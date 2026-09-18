import heapq
from typing import List


class Solution:
    def narrowestRange(self, series: List[List[int]]) -> List[int]:
        heap = [(one[0], which, 0) for which, one in enumerate(series)]
        heapq.heapify(heap)
        high = max(one[0] for one in series)

        best_low = heap[0][0]
        best_high = high

        while True:
            low, which, at = heapq.heappop(heap)
            # Strictly narrower, so the first range of a given width wins.
            if high - low < best_high - best_low:
                best_low = low
                best_high = high

            # That series has no readings left, so nothing further covers it.
            if at + 1 == len(series[which]):
                break

            following = series[which][at + 1]
            if following > high:
                high = following
            heapq.heappush(heap, (following, which, at + 1))

        return [best_low, best_high]
