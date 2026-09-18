from typing import List


class Solution:
    def smallestMissing(self, counts: List[int]) -> int:
        n = len(counts)

        for i in range(n):
            # Send counts[i] home, and whatever was there home in its turn.
            # Comparing against the destination stops duplicates looping.
            while 1 <= counts[i] <= n and counts[counts[i] - 1] != counts[i]:
                target = counts[i] - 1
                counts[i], counts[target] = counts[target], counts[i]

        for i in range(n):
            if counts[i] != i + 1:
                return i + 1
        return n + 1
