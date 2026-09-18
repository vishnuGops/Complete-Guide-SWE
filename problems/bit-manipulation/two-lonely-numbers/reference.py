from typing import List


class Solution:
    def theTwoLonelyOnes(self, values: List[int]) -> List[int]:
        both = 0
        for value in values:
            both ^= value

        # A bit where the two lonely values differ, isolated.
        bit = both & -both

        first = 0
        for value in values:
            if value & bit:
                first ^= value

        second = both ^ first
        return [first, second] if first < second else [second, first]
