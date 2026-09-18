from typing import List


class Solution:
    def canSplitEvenly(self, values: List[int]) -> bool:
        total = sum(values)
        if total % 2 == 1:
            return False
        half = total // 2

        reachable = [False] * (half + 1)
        reachable[0] = True   # the empty subset

        for value in values:
            # Downwards: each value may be spent once, so the cell being read
            # must not already include it.
            for target in range(half, value - 1, -1):
                if reachable[target - value]:
                    reachable[target] = True

        return reachable[half]
