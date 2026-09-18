from typing import List


class Solution:
    def sharedLength(self, first: str, second: str) -> int:
        # Keep the shorter word along the row, so the row is as short as it can be.
        if len(second) > len(first):
            first, second = second, first

        previous: List[int] = [0] * (len(second) + 1)
        current: List[int] = [0] * (len(second) + 1)

        for i in range(1, len(first) + 1):
            for j in range(1, len(second) + 1):
                if first[i - 1] == second[j - 1]:
                    # Equal last letters: some longest reading uses them both.
                    current[j] = previous[j - 1] + 1
                else:
                    current[j] = max(previous[j], current[j - 1])
            previous, current = current, previous

        return previous[len(second)]
