from typing import List


class Solution:
    def fewestCoins(self, coins: List[int], amount: int) -> int:
        # Larger than any real answer, since every coin is at least 1.
        unreachable = amount + 1
        fewest = [unreachable] * (amount + 1)
        fewest[0] = 0

        for total in range(1, amount + 1):
            for coin in coins:
                if coin <= total and fewest[total - coin] + 1 < fewest[total]:
                    fewest[total] = fewest[total - coin] + 1

        return -1 if fewest[amount] == unreachable else fewest[amount]
