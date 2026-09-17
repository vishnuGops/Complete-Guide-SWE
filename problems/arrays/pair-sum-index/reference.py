from typing import List


class Solution:
    def pairSumIndex(self, values: List[int], target: int) -> List[int]:
        seen = {}
        for i, value in enumerate(values):
            complement = target - value
            if complement in seen:
                return [seen[complement], i]
            # Keep the earliest index for a repeated value, matching reference.java.
            seen.setdefault(value, i)
        return []
