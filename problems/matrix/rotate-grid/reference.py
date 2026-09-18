from typing import List


class Solution:
    def turnGrid(self, grid: List[List[int]]) -> None:
        n = len(grid)

        # Reflect in the main diagonal. Only above it, or every swap is undone.
        for row in range(n):
            for column in range(row + 1, n):
                grid[row][column], grid[column][row] = grid[column][row], grid[row][column]

        # Reflect left to right.
        for row in range(n):
            left = 0
            right = n - 1
            while left < right:
                grid[row][left], grid[row][right] = grid[row][right], grid[row][left]
                left += 1
                right -= 1
