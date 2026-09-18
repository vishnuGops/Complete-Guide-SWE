from typing import List


class Solution:
    def roomsAtOnce(self, bookings: List[List[int]]) -> int:
        starts = sorted(booking[0] for booking in bookings)
        ends = sorted(booking[1] for booking in bookings)

        released = 0
        in_progress = 0
        best = 0

        for start in starts:
            # A booking that ended at or before this start frees its room.
            while ends[released] <= start:
                released += 1
                in_progress -= 1
            in_progress += 1
            if in_progress > best:
                best = in_progress

        return best
