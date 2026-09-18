from typing import List


class Solution:
    def insertPosition(self, readings: List[int], target: int) -> int:
        low = 0
        high = len(readings)

        while low < high:
            mid = low + (high - low) // 2
            if readings[mid] < target:
                low = mid + 1
            else:
                high = mid

        return low
