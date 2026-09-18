from typing import Optional


class Solution:
    def dropNthFromEnd(self, head: Optional[ListNode], n: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)
        lead = head
        follow = dummy

        for _ in range(n):
            lead = lead.next

        while lead is not None:
            lead = lead.next
            follow = follow.next

        follow.next = follow.next.next
        return dummy.next
