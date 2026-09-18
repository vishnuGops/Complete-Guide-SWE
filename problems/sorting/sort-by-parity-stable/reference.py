from typing import List


class Solution:
    def evensFirst(self, readings: List[int]) -> List[int]:
        evens: List[int] = []
        odds: List[int] = []
        for reading in readings:
            if reading % 2 == 0:
                evens.append(reading)
            else:
                odds.append(reading)
        return evens + odds
