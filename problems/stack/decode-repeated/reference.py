from typing import List


class Solution:
    def expand(self, shorthand: str) -> str:
        counts: List[int] = []
        texts: List[List[str]] = []
        current: List[str] = []
        count = 0

        for character in shorthand:
            if character.isdigit():
                count = count * 10 + int(character)
            elif character == "[":
                counts.append(count)
                count = 0
                texts.append(current)
                current = []
            elif character == "]":
                repeated = "".join(current) * counts.pop()
                current = texts.pop()
                current.append(repeated)
            else:
                current.append(character)

        return "".join(current)
