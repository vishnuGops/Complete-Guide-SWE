from typing import List


class Solution:
    def productExceptSelf(self, readings: List[int]) -> List[int]:
        n = len(readings)
        out = [1] * n

        running = 1
        for i in range(n):
            out[i] = running
            running *= readings[i]

        running = 1
        for i in range(n - 1, -1, -1):
            out[i] *= running
            running *= readings[i]

        return out
