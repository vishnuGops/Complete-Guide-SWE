from typing import Optional


class Solution:
    def cycleStart(self, head: Optional[ListNode]) -> int:
        slow = head
        fast = head
        met = None
        while fast is not None and fast.next is not None:
            slow = slow.next
            fast = fast.next.next
            if slow is fast:
                met = slow
                break
        if met is None:
            return -1

        # The run-up and the distance from the meeting point round to the
        # loop's start differ only by whole laps, so both walk at one link a
        # step from here.
        at = 0
        walker = head
        while walker is not met:
            walker = walker.next
            met = met.next
            at += 1
        return at
