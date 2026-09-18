from collections import deque
from typing import List


class Solution:
    def minutesUntilSpoiled(self, crate: List[List[int]]) -> int:
        rows = len(crate)
        columns = len(crate[0])

        queue = deque()
        fresh = 0
        for row in range(rows):
            for column in range(columns):
                if crate[row][column] == 2:
                    queue.append((row, column))
                elif crate[row][column] == 1:
                    fresh += 1

        minutes = 0
        while queue and fresh > 0:
            # Exactly the cells spoiled so far: one whole minute.
            for _ in range(len(queue)):
                row, column = queue.popleft()
                for next_row, next_column in (
                    (row - 1, column),
                    (row + 1, column),
                    (row, column - 1),
                    (row, column + 1),
                ):
                    if 0 <= next_row < rows and 0 <= next_column < columns:
                        if crate[next_row][next_column] == 1:
                            crate[next_row][next_column] = 2
                            fresh -= 1
                            queue.append((next_row, next_column))
            minutes += 1

        return minutes if fresh == 0 else -1
