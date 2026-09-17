from typing import List


class Solution:
    def longestRun(self, values: List[int]) -> int:
        present = set(values)
        best = 0
        for value in present:
            if value - 1 in present:
                continue
            length = 1
            while value + length in present:
                length += 1
            best = max(best, length)
        return best
