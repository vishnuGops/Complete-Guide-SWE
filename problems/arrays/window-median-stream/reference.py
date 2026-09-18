import heapq
from typing import Dict, List


class Solution:
    def windowMedians(self, readings: List[int], k: int) -> List[float]:
        # `small` is a max-heap of the smaller half, stored negated because
        # heapq is a min-heap. `large` is a min-heap of the larger half.
        small: List[int] = []
        large: List[int] = []
        # Readings that have left the window but are still inside a heap.
        owed: Dict[int, int] = {}
        small_size = 0
        large_size = 0

        def prune_small() -> None:
            while small and owed.get(-small[0], 0) > 0:
                value = -small[0]
                owed[value] -= 1
                if owed[value] == 0:
                    del owed[value]
                heapq.heappop(small)

        def prune_large() -> None:
            while large and owed.get(large[0], 0) > 0:
                value = large[0]
                owed[value] -= 1
                if owed[value] == 0:
                    del owed[value]
                heapq.heappop(large)

        def balance() -> None:
            nonlocal small_size, large_size
            if small_size > large_size + 1:
                heapq.heappush(large, -heapq.heappop(small))
                small_size -= 1
                large_size += 1
                prune_small()
            elif small_size < large_size:
                heapq.heappush(small, -heapq.heappop(large))
                small_size += 1
                large_size -= 1
                prune_large()

        def insert(value: int) -> None:
            nonlocal small_size, large_size
            if not small or value <= -small[0]:
                heapq.heappush(small, -value)
                small_size += 1
            else:
                heapq.heappush(large, value)
                large_size += 1
            balance()

        def erase(value: int) -> None:
            nonlocal small_size, large_size
            owed[value] = owed.get(value, 0) + 1
            if value <= -small[0]:
                small_size -= 1
                if value == -small[0]:
                    prune_small()
            else:
                large_size -= 1
                if value == large[0]:
                    prune_large()
            balance()

        out: List[float] = []
        for index, value in enumerate(readings):
            insert(value)
            if index >= k:
                erase(readings[index - k])
            if index >= k - 1:
                if k % 2 == 1:
                    out.append(float(-small[0]))
                else:
                    out.append((-small[0] + large[0]) / 2)
        return out
