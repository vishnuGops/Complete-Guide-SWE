from typing import List


class Solution:
    def readDiagonals(self, grid: List[List[int]]) -> List[int]:
        rows = len(grid)
        columns = len(grid[0])
        out: List[int] = []

        for total in range(rows + columns - 1):
            # column = total - row has to stay on the grid too.
            first = max(0, total - columns + 1)
            last = min(total, rows - 1)
            for row in range(first, last + 1):
                out.append(grid[row][total - row])

        return out
