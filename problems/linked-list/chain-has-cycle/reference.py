from typing import Optional


class Solution:
    def hasCycle(self, head: Optional[ListNode]) -> bool:
        slow = head
        fast = head
        # `fast` and `fast.next` both have to exist before the double step, or
        # an odd-length open chain walks off the end.
        while fast is not None and fast.next is not None:
            slow = slow.next
            fast = fast.next.next
            # Identity, not value: values are allowed to repeat.
            if slow is fast:
                return True
        return False
