from typing import List


class Solution:
    def waysToMake(self, coins: List[int], amount: int) -> int:
        ways = [0] * (amount + 1)
        ways[0] = 1   # one way to make nothing

        # Coins outside: each combination is assembled in one fixed order, so
        # it is counted once rather than once per ordering.
        for coin in coins:
            for total in range(coin, amount + 1):
                ways[total] += ways[total - coin]

        return ways[amount]
