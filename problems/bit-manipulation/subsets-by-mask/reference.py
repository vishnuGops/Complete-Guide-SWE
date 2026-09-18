from typing import List


class Solution:
    def subsetsInOrder(self, values: List[int]) -> List[List[int]]:
        n = len(values)
        out: List[List[int]] = []

        # Each number from 0 to 2^n - 1 names a different subset.
        for mask in range(1 << n):
            subset: List[int] = []
            for index in range(n):
                if mask >> index & 1:
                    subset.append(values[index])
            out.append(subset)

        return out
