from typing import List


class Solution:
    def fewestSwaps(self, readings: List[int]) -> int:
        n = len(readings)
        # home[i] is the position currently holding the reading that belongs
        # at position i.
        home = sorted(range(n), key=lambda position: readings[position])

        seen = [False] * n
        swaps = 0

        for start in range(n):
            if seen[start] or home[start] == start:
                continue
            length = 0
            at = start
            while not seen[at]:
                seen[at] = True
                at = home[at]
                length += 1
            swaps += length - 1

        return swaps
