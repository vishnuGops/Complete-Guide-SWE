import java.util.*;

class Solution {
    public ListNode collapseRepeats(ListNode head) {
        ListNode dummy = new ListNode(0, head);
        ListNode previous = dummy;
        ListNode current = head;

        while (current != null) {
            if (current.next != null && current.val == current.next.val) {
                int value = current.val;
                while (current != null && current.val == value) {
                    current = current.next;
                }
                previous.next = current;
            } else {
                previous = current;
                current = current.next;
            }
        }

        return dummy.next;
    }
}
