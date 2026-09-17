from collections import Counter
from typing import List


class Solution:
    def byFrequency(self, values: List[int]) -> List[int]:
        counts = Counter(values)
        return sorted(counts, key=lambda value: (-counts[value], value))
