from typing import List


class Solution:
    def theLonelyOne(self, values: List[int]) -> int:
        # Pairs cancel, whatever order they appear in.
        answer = 0
        for value in values:
            answer ^= value
        return answer
