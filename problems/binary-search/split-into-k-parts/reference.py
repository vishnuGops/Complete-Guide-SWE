from typing import List


class Solution:
    def fairestSplit(self, loads: List[int], k: int) -> int:
        low = max(loads)
        high = sum(loads)

        while low < high:
            mid = low + (high - low) // 2
            if self._workers_needed(loads, mid) <= k:
                high = mid
            else:
                low = mid + 1

        return low

    def _workers_needed(self, loads: List[int], cap: int) -> int:
        """The fewest runs whose totals all stay within `cap`."""
        workers = 1
        running = 0
        for load in loads:
            if running + load > cap:
                workers += 1
                running = load
            else:
                running += load
        return workers
