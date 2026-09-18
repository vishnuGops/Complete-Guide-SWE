import java.util.*;

class Solution {
    public ListNode reverseEveryK(ListNode head, int k) {
        ListNode dummy = new ListNode(0, head);
        ListNode groupPrev = dummy;

        while (true) {
            // Look before you leap: find the group's last link, if it exists.
            ListNode kth = groupPrev;
            for (int i = 0; i < k; i++) {
                kth = kth.next;
                if (kth == null) {
                    return dummy.next;
                }
            }
            ListNode groupNext = kth.next;

            // Reverse the group, seeding `previous` with what follows it so the
            // reversed tail is attached without a separate step.
            ListNode previous = groupNext;
            ListNode current = groupPrev.next;
            while (current != groupNext) {
                ListNode following = current.next;
                current.next = previous;
                previous = current;
                current = following;
            }

            ListNode newTail = groupPrev.next;
            groupPrev.next = kth;
            groupPrev = newTail;
        }
    }
}
