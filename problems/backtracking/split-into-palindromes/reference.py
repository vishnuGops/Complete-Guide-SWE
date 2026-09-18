from typing import List


class Solution:
    def palindromeCuts(self, word: str) -> List[List[str]]:
        out: List[List[str]] = []
        pieces: List[str] = []

        def reads_same(start: int, end: int) -> bool:
            left = start
            right = end - 1
            while left < right:
                if word[left] != word[right]:
                    return False
                left += 1
                right -= 1
            return True

        def build(at: int) -> None:
            if at == len(word):
                out.append(list(pieces))
                return
            for end in range(at + 1, len(word) + 1):
                # Checked before recursing: an invalid prefix kills the branch.
                if reads_same(at, end):
                    pieces.append(word[at:end])
                    build(end)
                    pieces.pop()

        build(0)
        return out
