from typing import List


class Solution:
    def mergeWindows(self, windows: List[List[int]]) -> List[List[int]]:
        if not windows:
            return []

        merged: List[List[int]] = []
        for start, end in sorted(windows):
            if merged and start <= merged[-1][1]:
                # Contained windows must not shorten the one they fall inside.
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        return merged
