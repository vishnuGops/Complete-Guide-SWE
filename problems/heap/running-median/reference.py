import heapq
from typing import List


class MedianStream:
    def __init__(self) -> None:
        # The smaller half, negated because heapq is a min-heap.
        self._small: List[int] = []
        # The larger half.
        self._large: List[int] = []

    def add(self, value: int) -> float:
        if not self._small or value <= -self._small[0]:
            heapq.heappush(self._small, -value)
        else:
            heapq.heappush(self._large, value)

        # Keep the halves within one of each other.
        if len(self._small) > len(self._large) + 1:
            heapq.heappush(self._large, -heapq.heappop(self._small))
        elif len(self._large) > len(self._small):
            heapq.heappush(self._small, -heapq.heappop(self._large))

        if len(self._small) > len(self._large):
            return float(-self._small[0])
        return (-self._small[0] + self._large[0]) / 2
