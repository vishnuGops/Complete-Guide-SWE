from collections import deque
from typing import List


class Solution:
    def fewestSteps(self, plan: List[List[int]]) -> int:
        rows = len(plan)
        columns = len(plan[0])

        if plan[0][0] != 0 or plan[rows - 1][columns - 1] != 0:
            return -1

        visited = [[False] * columns for _ in range(rows)]
        visited[0][0] = True
        queue = deque([(0, 0, 1)])

        while queue:
            row, column, distance = queue.popleft()
            if row == rows - 1 and column == columns - 1:
                return distance

            for next_row, next_column in (
                (row - 1, column),
                (row + 1, column),
                (row, column - 1),
                (row, column + 1),
            ):
                if 0 <= next_row < rows and 0 <= next_column < columns:
                    if plan[next_row][next_column] == 0 and not visited[next_row][next_column]:
                        # Marked when pushed, so a cell is queued once.
                        visited[next_row][next_column] = True
                        queue.append((next_row, next_column, distance + 1))

        return -1
