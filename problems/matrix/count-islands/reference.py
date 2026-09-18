from typing import List, Tuple


class Solution:
    def countIslands(self, terrain: List[List[int]]) -> int:
        rows = len(terrain)
        columns = len(terrain[0])
        islands = 0

        for start_row in range(rows):
            for start_column in range(columns):
                if terrain[start_row][start_column] != 1:
                    continue

                islands += 1
                # An explicit stack: a recursive fill would be ten thousand
                # frames deep on a full grid.
                stack: List[Tuple[int, int]] = [(start_row, start_column)]
                terrain[start_row][start_column] = 0
                while stack:
                    row, column = stack.pop()
                    for next_row, next_column in (
                        (row - 1, column),
                        (row + 1, column),
                        (row, column - 1),
                        (row, column + 1),
                    ):
                        if 0 <= next_row < rows and 0 <= next_column < columns:
                            if terrain[next_row][next_column] == 1:
                                # Marked when pushed, not when popped.
                                terrain[next_row][next_column] = 0
                                stack.append((next_row, next_column))

        return islands
