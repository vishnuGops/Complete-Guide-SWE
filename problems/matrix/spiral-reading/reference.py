from typing import List


class Solution:
    def readSpiral(self, grid: List[List[int]]) -> List[int]:
        out: List[int] = []
        top = 0
        bottom = len(grid) - 1
        left = 0
        right = len(grid[0]) - 1

        while top <= bottom and left <= right:
            for column in range(left, right + 1):
                out.append(grid[top][column])
            top += 1

            for row in range(top, bottom + 1):
                out.append(grid[row][right])
            right -= 1

            # A ring one row thick has already been read by the first run.
            if top <= bottom:
                for column in range(right, left - 1, -1):
                    out.append(grid[bottom][column])
                bottom -= 1

            # A ring one column thick, likewise.
            if left <= right:
                for row in range(bottom, top - 1, -1):
                    out.append(grid[row][left])
                left += 1

        return out
