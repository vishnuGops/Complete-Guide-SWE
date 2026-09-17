from typing import List


class Solution:
    def minCapacity(self, weights: List[int], days: int) -> int:
        def days_needed(capacity: int) -> int:
            used = 1
            carried = 0
            for weight in weights:
                if carried + weight > capacity:
                    used += 1
                    carried = 0
                carried += weight
            return used

        low = max(weights)
        high = sum(weights)
        while low < high:
            mid = (low + high) // 2
            if days_needed(mid) <= days:
                high = mid
            else:
                low = mid + 1
        return low
