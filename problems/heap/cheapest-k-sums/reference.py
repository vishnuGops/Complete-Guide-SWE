import heapq
from typing import List


class Solution:
    def cheapestPairs(self, first: List[int], second: List[int], k: int) -> List[List[int]]:
        # Only the first k rows can contribute: row i is never cheaper than
        # row i - 1.
        heap = []
        for i in range(min(k, len(first))):
            heapq.heappush(heap, (first[i] + second[0], i, 0))

        out: List[List[int]] = []
        while heap and len(out) < k:
            _, i, j = heapq.heappop(heap)
            out.append([first[i], second[j]])
            if j + 1 < len(second):
                heapq.heappush(heap, (first[i] + second[j + 1], i, j + 1))

        return out
