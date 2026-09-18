import heapq
from typing import List


class RunningKthLargest:
    def __init__(self, k: int, first: List[int]) -> None:
        self._k = k
        # A min-heap of the k largest readings; its root is the answer.
        self._heap: List[int] = []
        for value in first:
            self._push(value)

    def add(self, value: int) -> int:
        self._push(value)
        return self._heap[0]

    def _push(self, value: int) -> None:
        if len(self._heap) < self._k:
            heapq.heappush(self._heap, value)
        elif value > self._heap[0]:
            heapq.heapreplace(self._heap, value)
