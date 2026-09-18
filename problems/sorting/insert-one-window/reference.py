from typing import List


class Solution:
    def insertWindow(self, schedule: List[List[int]], added: List[int]) -> List[List[int]]:
        out: List[List[int]] = []
        start, end = added[0], added[1]
        i = 0
        n = len(schedule)

        # Before: ends strictly before the new window starts.
        while i < n and schedule[i][1] < start:
            out.append(schedule[i])
            i += 1

        # Meeting: starts at or before the new window ends.
        while i < n and schedule[i][0] <= end:
            start = min(start, schedule[i][0])
            end = max(end, schedule[i][1])
            i += 1
        out.append([start, end])

        # After.
        while i < n:
            out.append(schedule[i])
            i += 1

        return out
