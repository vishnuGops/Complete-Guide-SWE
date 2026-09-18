import java.util.*;

class Solution {
    public ListNode addChains(ListNode first, ListNode second) {
        ListNode dummy = new ListNode();
        ListNode tail = dummy;
        int carry = 0;

        while (first != null || second != null || carry != 0) {
            int total = carry;
            if (first != null) {
                total += first.val;
                first = first.next;
            }
            if (second != null) {
                total += second.val;
                second = second.next;
            }

            tail.next = new ListNode(total % 10);
            tail = tail.next;
            carry = total / 10;
        }

        return dummy.next;
    }
}
