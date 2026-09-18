from typing import Dict, List, Tuple


class Solution:
    def largestAfterFilling(self, terrain: List[List[int]]) -> int:
        rows = len(terrain)
        columns = len(terrain[0])

        def neighbours(row: int, column: int):
            for next_row, next_column in (
                (row - 1, column),
                (row + 1, column),
                (row, column - 1),
                (row, column + 1),
            ):
                if 0 <= next_row < rows and 0 <= next_column < columns:
                    yield next_row, next_column

        # Label each island in place; 0 and 1 are taken, so labels start at 2.
        sizes: Dict[int, int] = {}
        label = 2
        for start_row in range(rows):
            for start_column in range(columns):
                if terrain[start_row][start_column] != 1:
                    continue
                stack: List[Tuple[int, int]] = [(start_row, start_column)]
                terrain[start_row][start_column] = label
                size = 0
                while stack:
                    row, column = stack.pop()
                    size += 1
                    for next_row, next_column in neighbours(row, column):
                        if terrain[next_row][next_column] == 1:
                            terrain[next_row][next_column] = label
                            stack.append((next_row, next_column))
                sizes[label] = size
                label += 1

        best = max(sizes.values()) if sizes else 0

        for row in range(rows):
            for column in range(columns):
                if terrain[row][column] != 0:
                    continue
                # Distinct labels only: one island can touch this cell twice.
                touching = set()
                for next_row, next_column in neighbours(row, column):
                    if terrain[next_row][next_column] >= 2:
                        touching.add(terrain[next_row][next_column])
                total = 1 + sum(sizes[found] for found in touching)
                if total > best:
                    best = total

        return best
