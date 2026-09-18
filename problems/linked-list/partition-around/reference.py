from typing import Optional


class Solution:
    def partitionAround(self, head: Optional[ListNode], pivot: int) -> Optional[ListNode]:
        low_dummy = ListNode()
        high_dummy = ListNode()
        low_tail = low_dummy
        high_tail = high_dummy

        current = head
        while current is not None:
            if current.val < pivot:
                low_tail.next = current
                low_tail = current
            else:
                high_tail.next = current
                high_tail = current
            current = current.next

        # Terminate the upper run, or its last link still points into the lower.
        high_tail.next = None
        low_tail.next = high_dummy.next
        return low_dummy.next
