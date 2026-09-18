import java.util.*;

class Solution {
    public ListNode reverseChain(ListNode head) {
        ListNode previous = null;
        ListNode current = head;
        while (current != null) {
            ListNode following = current.next;
            current.next = previous;
            previous = current;
            current = following;
        }
        return previous;
    }
}
