from typing import List


class Solution:
    def pathsAcross(self, grid: List[List[int]]) -> int:
        rows = len(grid)
        columns = len(grid[0])

        # One row of the table, updated in place: a cell needs only the value
        # above it (still in the array) and to its left (already updated).
        routes = [0] * columns
        routes[0] = 1

        for row in range(rows):
            for column in range(columns):
                if grid[row][column] == 1:
                    routes[column] = 0
                elif column > 0:
                    routes[column] += routes[column - 1]

        return routes[columns - 1]
