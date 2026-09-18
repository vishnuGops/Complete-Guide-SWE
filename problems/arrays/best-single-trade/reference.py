from typing import List


class Solution:
    def bestTrade(self, prices: List[int]) -> int:
        cheapest = prices[0]
        best = 0
        for price in prices:
            if price - cheapest > best:
                best = price - cheapest
            if price < cheapest:
                cheapest = price
        return best
