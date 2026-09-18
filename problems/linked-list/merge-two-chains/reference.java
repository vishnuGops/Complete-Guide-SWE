import java.util.*;

class Solution {
    public ListNode mergeChains(ListNode first, ListNode second) {
        ListNode dummy = new ListNode();
        ListNode tail = dummy;

        while (first != null && second != null) {
            if (first.val <= second.val) {
                tail.next = first;
                first = first.next;
            } else {
                tail.next = second;
                second = second.next;
            }
            tail = tail.next;
        }

        tail.next = first != null ? first : second;
        return dummy.next;
    }
}
