import java.util.*;

class Solution {
    public boolean hasCycle(ListNode head) {
        ListNode slow = head;
        ListNode fast = head;
        // Both `fast` and `fast.next` have to exist before the double step.
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            // Reference equality: the values are allowed to repeat.
            if (slow == fast) {
                return true;
            }
        }
        return false;
    }
}
