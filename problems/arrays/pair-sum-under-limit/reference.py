from typing import List


class Solution:
    def countPairs(self, weights: List[int], limit: int) -> int:
        low = 0
        high = len(weights) - 1
        pairs = 0
        while low < high:
            if weights[low] + weights[high] <= limit:
                # Everything between low and high is no heavier than weights[high],
                # so each of those also pairs with weights[low].
                pairs += high - low
                low += 1
            else:
                high -= 1
        return pairs
