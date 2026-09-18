from typing import List


class Solution:
    def peakPosition(self, readings: List[int]) -> int:
        low = 0
        high = len(readings) - 1

        # Invariant: the peak is always inside [low, high].
        while low < high:
            mid = low + (high - low) // 2
            if readings[mid] < readings[mid + 1]:
                low = mid + 1
            else:
                high = mid

        return low
