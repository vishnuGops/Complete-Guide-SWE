from typing import Optional


class Solution:
    def addChains(self, first: Optional[ListNode], second: Optional[ListNode]) -> Optional[ListNode]:
        dummy = ListNode()
        tail = dummy
        carry = 0

        while first is not None or second is not None or carry != 0:
            total = carry
            if first is not None:
                total += first.val
                first = first.next
            if second is not None:
                total += second.val
                second = second.next

            tail.next = ListNode(total % 10)
            tail = tail.next
            carry = total // 10

        return dummy.next
