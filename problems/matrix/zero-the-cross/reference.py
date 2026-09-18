from typing import List


class Solution:
    def blankTheCross(self, grid: List[List[int]]) -> None:
        rows = len(grid)
        columns = len(grid[0])

        # grid[0][0] cannot mean both "blank row 0" and "blank column 0", so
        # the first column gets its own flag.
        first_column_blank = any(grid[row][0] == 0 for row in range(rows))

        for row in range(rows):
            for column in range(1, columns):
                if grid[row][column] == 0:
                    grid[row][0] = 0
                    grid[0][column] = 0

        # The interior first: the marks live in row 0 and column 0.
        for row in range(1, rows):
            for column in range(1, columns):
                if grid[row][0] == 0 or grid[0][column] == 0:
                    grid[row][column] = 0

        if grid[0][0] == 0:
            for column in range(columns):
                grid[0][column] = 0

        if first_column_blank:
            for row in range(rows):
                grid[row][0] = 0
