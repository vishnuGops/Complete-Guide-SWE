from typing import Dict, List


class Solution:
    def hasRepeatWithin(self, readings: List[int], k: int) -> bool:
        last_seen: Dict[int, int] = {}
        for index, value in enumerate(readings):
            previous = last_seen.get(value)
            if previous is not None and index - previous <= k:
                return True
            last_seen[value] = index
        return False
