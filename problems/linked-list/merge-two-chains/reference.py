from typing import Optional


class Solution:
    def mergeChains(self, first: Optional[ListNode], second: Optional[ListNode]) -> Optional[ListNode]:
        dummy = ListNode()
        tail = dummy

        while first is not None and second is not None:
            if first.val <= second.val:
                tail.next = first
                first = first.next
            else:
                tail.next = second
                second = second.next
            tail = tail.next

        tail.next = first if first is not None else second
        return dummy.next
