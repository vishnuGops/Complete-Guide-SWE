from typing import Dict, List


class Solution:
    def everyReading(self, letters: str, dictionary: List[str]) -> List[str]:
        words = set(dictionary)
        # Position -> every reading of the letters from there onwards.
        memo: Dict[int, List[str]] = {}

        def readings(at: int) -> List[str]:
            if at == len(letters):
                # One way to read nothing, not zero ways.
                return [""]
            if at in memo:
                return memo[at]

            out: List[str] = []
            for end in range(at + 1, len(letters) + 1):
                word = letters[at:end]
                if word not in words:
                    continue
                for rest in readings(end):
                    out.append(word if not rest else word + " " + rest)

            memo[at] = out
            return out

        return readings(0)
