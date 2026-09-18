from typing import List


class Solution:
    def cheapestAcross(self, tolls: List[List[int]]) -> int:
        rows = len(tolls)
        columns = len(tolls[0])

        # One row of the table, updated in place.
        cheapest = [0] * columns

        for row in range(rows):
            for column in range(columns):
                if row == 0 and column == 0:
                    cheapest[0] = tolls[0][0]
                elif row == 0:
                    cheapest[column] = cheapest[column - 1] + tolls[row][column]
                elif column == 0:
                    cheapest[column] = cheapest[column] + tolls[row][column]
                else:
                    cheapest[column] = min(cheapest[column], cheapest[column - 1]) + tolls[row][column]

        return cheapest[columns - 1]
