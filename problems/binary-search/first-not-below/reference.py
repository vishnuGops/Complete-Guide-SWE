from typing import List


class Solution:
    def firstNotBelow(self, values: List[int], threshold: int) -> int:
        low = 0
        high = len(values)
        while low < high:
            mid = (low + high) // 2
            if values[mid] >= threshold:
                high = mid
            else:
                low = mid + 1
        return low
