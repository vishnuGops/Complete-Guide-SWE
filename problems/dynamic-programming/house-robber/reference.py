from typing import List


class Solution:
    def bestHaul(self, houses: List[int]) -> int:
        # The best up to two houses back, and up to one house back.
        two_back = 0
        one_back = 0

        for amount in houses:
            two_back, one_back = one_back, max(one_back, two_back + amount)

        return one_back
