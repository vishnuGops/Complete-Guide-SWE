from typing import List


class Solution:
    def gridContains(self, grid: List[List[int]], target: int) -> bool:
        rows = len(grid)
        columns = len(grid[0])

        low = 0
        high = rows * columns - 1

        while low <= high:
            mid = low + (high - low) // 2
            value = grid[mid // columns][mid % columns]
            if value == target:
                return True
            if value < target:
                low = mid + 1
            else:
                high = mid - 1

        return False
