from typing import List


class Solution:
    def partitionEvenFirst(self, values: List[int]) -> None:
        evens = [value for value in values if value % 2 == 0]
        odds = [value for value in values if value % 2 != 0]
        # Slice assignment writes through to the caller's list; plain assignment
        # would only rebind the local name.
        values[:] = evens + odds
