from typing import Dict, List


class Solution:
    def longestStretch(self, values: List[int], limit: int) -> int:
        counts: Dict[int, int] = {}
        best = 0
        left = 0
        for right, value in enumerate(values):
            counts[value] = counts.get(value, 0) + 1
            while len(counts) > limit:
                leaving = values[left]
                counts[leaving] -= 1
                if counts[leaving] == 0:
                    del counts[leaving]
                left += 1
            best = max(best, right - left + 1)
        return best
