from typing import List


class Solution:
    def peakWindowStart(self, values: List[int], width: int) -> int:
        total = sum(values[:width])
        best_total = total
        best_start = 0
        for start in range(1, len(values) - width + 1):
            total += values[start + width - 1] - values[start - 1]
            if total > best_total:
                best_total = total
                best_start = start
        return best_start
