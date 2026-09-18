from typing import Dict, List


class Solution:
    def findWord(self, board: List[List[str]], word: str) -> bool:
        rows = len(board)
        columns = len(board[0])

        if len(word) > rows * columns:
            return False

        # The board must hold at least as many of each letter as the word needs.
        counts: Dict[str, int] = {}
        for row in board:
            for letter in row:
                counts[letter] = counts.get(letter, 0) + 1
        needed: Dict[str, int] = {}
        for letter in word:
            needed[letter] = needed.get(letter, 0) + 1
        for letter, how_many in needed.items():
            if counts.get(letter, 0) < how_many:
                return False

        # Start from the rarer end: the same path, walked backwards.
        if counts.get(word[0], 0) > counts.get(word[-1], 0):
            word = word[::-1]

        def search(row: int, column: int, at: int) -> bool:
            if at == len(word):
                return True
            if row < 0 or row >= rows or column < 0 or column >= columns:
                return False
            if board[row][column] != word[at]:
                return False

            saved = board[row][column]
            board[row][column] = "#"
            found = (
                search(row + 1, column, at + 1)
                or search(row - 1, column, at + 1)
                or search(row, column + 1, at + 1)
                or search(row, column - 1, at + 1)
            )
            board[row][column] = saved
            return found

        for row in range(rows):
            for column in range(columns):
                if search(row, column, 0):
                    return True
        return False
