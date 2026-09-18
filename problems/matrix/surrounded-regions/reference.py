from typing import List, Tuple


class Solution:
    def fillEnclosed(self, plan: List[List[int]]) -> None:
        rows = len(plan)
        columns = len(plan[0])

        # Seed from every open cell on the edge.
        stack: List[Tuple[int, int]] = []
        for row in range(rows):
            for column in (0, columns - 1):
                if plan[row][column] == 0:
                    plan[row][column] = 2
                    stack.append((row, column))
        for column in range(columns):
            for row in (0, rows - 1):
                if plan[row][column] == 0:
                    plan[row][column] = 2
                    stack.append((row, column))

        # An explicit stack: an all-open plan is one region of ten thousand.
        while stack:
            row, column = stack.pop()
            for next_row, next_column in (
                (row - 1, column),
                (row + 1, column),
                (row, column - 1),
                (row, column + 1),
            ):
                if 0 <= next_row < rows and 0 <= next_column < columns:
                    if plan[next_row][next_column] == 0:
                        plan[next_row][next_column] = 2
                        stack.append((next_row, next_column))

        # Unreached open cells are enclosed; reached ones go back to open.
        for row in range(rows):
            for column in range(columns):
                if plan[row][column] == 0:
                    plan[row][column] = 1
                elif plan[row][column] == 2:
                    plan[row][column] = 0
