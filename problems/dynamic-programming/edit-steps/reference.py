from typing import List


class Solution:
    def fewestEdits(self, start: str, into: str) -> int:
        # Keep the shorter word along the row.
        if len(into) > len(start):
            start, into = into, start

        # Row 0: turning nothing into the first j letters costs j insertions.
        previous: List[int] = list(range(len(into) + 1))
        current: List[int] = [0] * (len(into) + 1)

        for i in range(1, len(start) + 1):
            # Column 0: turning i letters into nothing costs i deletions.
            current[0] = i
            for j in range(1, len(into) + 1):
                if start[i - 1] == into[j - 1]:
                    current[j] = previous[j - 1]
                else:
                    current[j] = 1 + min(
                        previous[j],        # delete
                        current[j - 1],     # insert
                        previous[j - 1],    # replace
                    )
            previous, current = current, previous

        return previous[len(into)]
