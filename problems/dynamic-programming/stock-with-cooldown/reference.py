from typing import List


class Solution:
    def bestProfit(self, prices: List[int]) -> int:
        # Owning an item on day zero is impossible, not free.
        holding = -10**9
        sold = 0
        free = 0

        for price in prices:
            # All three read yesterday's values, so they are computed together.
            holding, sold, free = (
                max(holding, free - price),
                holding + price,
                max(free, sold),
            )

        return max(sold, free)
