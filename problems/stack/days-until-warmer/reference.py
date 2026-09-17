from typing import List


class Solution:
    def daysUntilWarmer(self, temperatures: List[int]) -> List[int]:
        waits = [0] * len(temperatures)
        waiting: List[int] = []
        for day, temperature in enumerate(temperatures):
            while waiting and temperatures[waiting[-1]] < temperature:
                earlier = waiting.pop()
                waits[earlier] = day - earlier
            waiting.append(day)
        return waits
