from typing import List


class Solution:
    def bestBurst(self, balloons: List[int]) -> int:
        # A 1 at each end, so a missing neighbour is an ordinary cell.
        padded = [1] + balloons + [1]
        n = len(padded)

        # best[left][right]: the balloons strictly between them, all burst.
        best = [[0] * n for _ in range(n)]

        # By increasing gap, so both halves are known before the whole.
        for gap in range(2, n):
            for left in range(0, n - gap):
                right = left + gap
                for last in range(left + 1, right):
                    score = (best[left][last] + best[last][right]
                             + padded[left] * padded[last] * padded[right])
                    if score > best[left][right]:
                        best[left][right] = score

        return best[0][n - 1]
