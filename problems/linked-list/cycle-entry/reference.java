import java.util.*;

class Solution {
    public int cycleStart(ListNode head) {
        ListNode slow = head;
        ListNode fast = head;
        ListNode met = null;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) {
                met = slow;
                break;
            }
        }
        if (met == null) {
            return -1;
        }

        // The run-up and the distance from the meeting point round to the
        // loop's start differ only by whole laps, so both walk at one step.
        int at = 0;
        ListNode walker = head;
        while (walker != met) {
            walker = walker.next;
            met = met.next;
            at++;
        }
        return at;
    }
}
