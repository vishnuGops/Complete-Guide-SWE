from typing import Optional


class Solution:
    def foldChain(self, head: Optional[ListNode]) -> Optional[ListNode]:
        if head is None or head.next is None:
            return head

        # The middle, cut so the first half is never the shorter one.
        slow = head
        fast = head
        while fast.next is not None and fast.next.next is not None:
            slow = slow.next
            fast = fast.next.next

        second = slow.next
        slow.next = None

        # Reverse the second half.
        previous = None
        while second is not None:
            following = second.next
            second.next = previous
            previous = second
            second = following

        # Weave the two halves together.
        first = head
        second = previous
        while second is not None:
            after_first = first.next
            after_second = second.next
            first.next = second
            second.next = after_first
            first = after_first
            second = after_second

        return head
