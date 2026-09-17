from collections import Counter
from typing import List


class Solution:
    def countDistinctPairs(self, values: List[int], gap: int) -> int:
        counts = Counter(values)
        if gap == 0:
            return sum(1 for times in counts.values() if times > 1)
        return sum(1 for value in counts if value + gap in counts)
