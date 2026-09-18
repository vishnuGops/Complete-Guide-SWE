from typing import Dict


class Solution:
    def sameLetters(self, first: str, second: str) -> bool:
        if len(first) != len(second):
            return False

        tally: Dict[str, int] = {}
        for letter in first:
            tally[letter] = tally.get(letter, 0) + 1
        for letter in second:
            if letter not in tally:
                return False
            tally[letter] -= 1
            if tally[letter] == 0:
                del tally[letter]

        return not tally
