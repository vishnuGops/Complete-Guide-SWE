import bisect
from typing import List


class Solution:
    def longestRising(self, readings: List[int]) -> int:
        # tails[i] is the smallest value a run of length i + 1 can end with.
        tails: List[int] = []

        for value in readings:
            # bisect_left, not bisect_right: strictly increasing, so an equal
            # value replaces rather than extends.
            at = bisect.bisect_left(tails, value)
            if at == len(tails):
                tails.append(value)
            else:
                tails[at] = value

        return len(tails)
