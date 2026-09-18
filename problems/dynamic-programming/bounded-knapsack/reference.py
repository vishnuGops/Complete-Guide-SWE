from typing import List


class Solution:
    def bestLoad(self, weights: List[int], worths: List[int], capacity: int) -> int:
        best = [0] * (capacity + 1)

        for index in range(len(weights)):
            weight = weights[index]
            worth = worths[index]
            # Downwards: the cell being read must not already include this item.
            for room in range(capacity, weight - 1, -1):
                if best[room - weight] + worth > best[room]:
                    best[room] = best[room - weight] + worth

        return best[capacity]
