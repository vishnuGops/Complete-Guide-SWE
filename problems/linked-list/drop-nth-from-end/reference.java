import java.util.*;

class Solution {
    public ListNode dropNthFromEnd(ListNode head, int n) {
        ListNode dummy = new ListNode(0, head);
        ListNode lead = head;
        ListNode follow = dummy;

        for (int i = 0; i < n; i++) {
            lead = lead.next;
        }

        while (lead != null) {
            lead = lead.next;
            follow = follow.next;
        }

        follow.next = follow.next.next;
        return dummy.next;
    }
}
