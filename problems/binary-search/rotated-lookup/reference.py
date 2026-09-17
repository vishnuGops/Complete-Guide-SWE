from typing import List


class Solution:
    def findRotated(self, values: List[int], target: int) -> int:
        low = 0
        high = len(values) - 1
        while low <= high:
            mid = (low + high) // 2
            if values[mid] == target:
                return mid
            if values[low] <= values[mid]:
                # The left half is sorted, so its range decides.
                if values[low] <= target < values[mid]:
                    high = mid - 1
                else:
                    low = mid + 1
            else:
                if values[mid] < target <= values[high]:
                    low = mid + 1
                else:
                    high = mid - 1
        return -1
