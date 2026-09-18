from typing import List


class Solution:
    def widestBlock(self, heights: List[int]) -> int:
        n = len(heights)
        best = 0
        # Positions whose right boundary is unknown, in increasing height.
        waiting: List[int] = []

        for i in range(n + 1):
            # A sentinel of height 0 settles whatever is still waiting.
            current = heights[i] if i < n else 0
            while waiting and heights[waiting[-1]] >= current:
                height = heights[waiting.pop()]
                left = waiting[-1] + 1 if waiting else 0
                area = height * (i - left)
                if area > best:
                    best = area
            waiting.append(i)

        return best
