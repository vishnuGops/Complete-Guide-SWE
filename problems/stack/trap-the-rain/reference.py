from typing import List


class Solution:
    def waterHeld(self, heights: List[int]) -> int:
        left = 0
        right = len(heights) - 1
        left_max = 0
        right_max = 0
        total = 0

        while left < right:
            # The shorter side is the one whose wall is binding, so its water
            # is already decided.
            if heights[left] < heights[right]:
                if heights[left] > left_max:
                    left_max = heights[left]
                total += left_max - heights[left]
                left += 1
            else:
                if heights[right] > right_max:
                    right_max = heights[right]
                total += right_max - heights[right]
                right -= 1

        return total
