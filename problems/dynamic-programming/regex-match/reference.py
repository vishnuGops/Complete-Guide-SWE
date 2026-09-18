from typing import List


class Solution:
    def matches(self, text: str, pattern: str) -> bool:
        n = len(text)
        m = len(pattern)

        # ok[i][j]: the first i letters matched by the first j pattern parts.
        ok: List[List[bool]] = [[False] * (m + 1) for _ in range(n + 1)]
        ok[0][0] = True

        # The empty text: only groups that can match nothing.
        for j in range(2, m + 1):
            if pattern[j - 1] == "*":
                ok[0][j] = ok[0][j - 2]

        for i in range(1, n + 1):
            for j in range(1, m + 1):
                part = pattern[j - 1]
                if part == "*":
                    before = pattern[j - 2]
                    # Zero occurrences, or one more of the same thing.
                    ok[i][j] = ok[i][j - 2] or (
                        ok[i - 1][j] and (before == "." or before == text[i - 1])
                    )
                else:
                    ok[i][j] = ok[i - 1][j - 1] and (part == "." or part == text[i - 1])

        return ok[n][m]
