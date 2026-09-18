from typing import Optional


class Solution:
    def reverseEveryK(self, head: Optional[ListNode], k: int) -> Optional[ListNode]:
        dummy = ListNode(0, head)
        group_prev = dummy

        while True:
            # Look before you leap: find the group's last link, if it exists.
            kth = group_prev
            for _ in range(k):
                kth = kth.next
                if kth is None:
                    return dummy.next
            group_next = kth.next

            # Reverse the group, seeding `previous` with what follows it so the
            # reversed tail is attached without a separate step.
            previous = group_next
            current = group_prev.next
            while current is not group_next:
                following = current.next
                current.next = previous
                previous = current
                current = following

            new_tail = group_prev.next
            group_prev.next = kth
            group_prev = new_tail
