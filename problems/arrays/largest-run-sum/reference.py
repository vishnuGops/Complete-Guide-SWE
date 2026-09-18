from typing import List


class Solution:
    def largestRunSum(self, values: List[int]) -> int:
        best_here = values[0]
        best = values[0]
        for value in values[1:]:
            best_here = max(value, best_here + value)
            if best_here > best:
                best = best_here
        return best
