from typing import List

LETTERS = {
    "2": "abc",
    "3": "def",
    "4": "ghi",
    "5": "jkl",
    "6": "mno",
    "7": "pqrs",
    "8": "tuv",
    "9": "wxyz",
}


class Solution:
    def keypadWords(self, digits: str) -> List[str]:
        # No digits means no strings, not one empty string.
        if not digits:
            return []

        out: List[str] = []
        sofar: List[str] = []

        def build(at: int) -> None:
            if at == len(digits):
                out.append("".join(sofar))
                return
            for letter in LETTERS[digits[at]]:
                sofar.append(letter)
                build(at + 1)
                sofar.pop()

        build(0)
        return out
