from typing import List


class Solution:
    def closestReadings(self, readings: List[int], k: int, target: int) -> List[int]:
        low = 0
        high = len(readings) - k

        while low < high:
            mid = (low + high) // 2
            # Is the reading being dropped further away than the one gained?
            if target - readings[mid] > readings[mid + k] - target:
                low = mid + 1
            else:
                high = mid

        return readings[low:low + k]
