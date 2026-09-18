from typing import Optional


class Solution:
    def readsSameBothWays(self, head: Optional[ListNode]) -> bool:
        # The middle, by the two-speed walk.
        slow = head
        fast = head
        while fast is not None and fast.next is not None:
            slow = slow.next
            fast = fast.next.next

        second = self._reverse(slow)

        # Walk both halves inwards; the odd chain's middle link has no partner.
        answer = True
        left = head
        right = second
        while right is not None:
            if left.val != right.val:
                answer = False
                break
            left = left.next
            right = right.next

        # Put the chain back the way it was handed over.
        self._reverse(second)
        return answer

    def _reverse(self, head: Optional[ListNode]) -> Optional[ListNode]:
        previous = None
        current = head
        while current is not None:
            following = current.next
            current.next = previous
            previous = current
            current = following
        return previous
