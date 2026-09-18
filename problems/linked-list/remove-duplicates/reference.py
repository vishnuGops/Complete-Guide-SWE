from typing import Optional


class Solution:
    def collapseRepeats(self, head: Optional[ListNode]) -> Optional[ListNode]:
        dummy = ListNode(0, head)
        previous = dummy
        current = head

        while current is not None:
            if current.next is not None and current.val == current.next.val:
                value = current.val
                while current is not None and current.val == value:
                    current = current.next
                previous.next = current
            else:
                previous = current
                current = current.next

        return dummy.next
