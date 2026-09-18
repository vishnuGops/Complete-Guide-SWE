from typing import List


class Solution:
    def firstAndLast(self, readings: List[int], target: int) -> List[int]:
        low = self._boundary(readings, target, False)
        high = self._boundary(readings, target, True)
        if low == high:
            return [-1, -1]
        return [low, high - 1]

    def _boundary(self, readings: List[int], target: int, inclusive: bool) -> int:
        """First index where readings[i] >= target, or > target when inclusive."""
        low = 0
        high = len(readings)
        while low < high:
            mid = low + (high - low) // 2
            below = readings[mid] <= target if inclusive else readings[mid] < target
            if below:
                low = mid + 1
            else:
                high = mid
        return low
