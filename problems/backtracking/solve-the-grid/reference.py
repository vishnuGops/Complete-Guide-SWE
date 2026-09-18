from typing import List, Tuple


class Solution:
    def fillGrid(self, grid: List[List[int]]) -> None:
        row_used = [0] * 9
        column_used = [0] * 9
        box_used = [0] * 9
        blanks: List[Tuple[int, int]] = []

        for row in range(9):
            for column in range(9):
                digit = grid[row][column]
                if digit == 0:
                    blanks.append((row, column))
                else:
                    bit = 1 << digit
                    row_used[row] |= bit
                    column_used[column] |= bit
                    box_used[(row // 3) * 3 + column // 3] |= bit

        def solve(at: int) -> bool:
            if at == len(blanks):
                return True
            row, column = blanks[at]
            box = (row // 3) * 3 + column // 3
            for digit in range(1, 10):
                bit = 1 << digit
                # Legal here, checked before writing.
                if (row_used[row] | column_used[column] | box_used[box]) & bit:
                    continue
                grid[row][column] = digit
                row_used[row] |= bit
                column_used[column] |= bit
                box_used[box] |= bit

                if solve(at + 1):
                    return True

                grid[row][column] = 0
                row_used[row] &= ~bit
                column_used[column] &= ~bit
                box_used[box] &= ~bit
            return False

        solve(0)
