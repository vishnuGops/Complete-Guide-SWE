from collections import deque
from typing import List


class Solution:
    def windowMaxima(self, readings: List[int], k: int) -> List[int]:
        out: List[int] = []
        # Positions of the readings that are still candidates, decreasing.
        candidates = deque()

        for at, value in enumerate(readings):
            # Evicted by value: something larger arrived after them.
            while candidates and readings[candidates[-1]] <= value:
                candidates.pop()
            candidates.append(at)

            # Evicted by age: fallen out of the window.
            if candidates[0] <= at - k:
                candidates.popleft()

            if at >= k - 1:
                out.append(readings[candidates[0]])

        return out
