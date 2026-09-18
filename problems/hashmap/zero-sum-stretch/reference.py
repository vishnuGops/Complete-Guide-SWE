from typing import Dict, List


class Solution:
    def cancellingStretches(self, changes: List[int]) -> int:
        # The moment before the first change, whose running total is zero.
        seen: Dict[int, int] = {0: 1}
        running = 0
        found = 0

        for change in changes:
            running += change
            found += seen.get(running, 0)
            seen[running] = seen.get(running, 0) + 1

        return found
