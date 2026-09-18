from typing import List


class Solution:
    def missingNumber(self, values: List[int]) -> int:
        # Everything present appears in both collections and cancels.
        answer = len(values)
        for index, value in enumerate(values):
            answer ^= index ^ value
        return answer
