from typing import List


class Solution:
    def runningMaximum(self, readings: List[int]) -> List[int]:
        best = readings[0]
        out = []
        for reading in readings:
            if reading > best:
                best = reading
            out.append(best)
        return out
