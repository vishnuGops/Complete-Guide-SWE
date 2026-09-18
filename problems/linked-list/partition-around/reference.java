import java.util.*;

class Solution {
    public ListNode partitionAround(ListNode head, int pivot) {
        ListNode lowDummy = new ListNode();
        ListNode highDummy = new ListNode();
        ListNode lowTail = lowDummy;
        ListNode highTail = highDummy;

        for (ListNode current = head; current != null; current = current.next) {
            if (current.val < pivot) {
                lowTail.next = current;
                lowTail = current;
            } else {
                highTail.next = current;
                highTail = current;
            }
        }

        // Terminate the upper run, or its last link still points into the lower.
        highTail.next = null;
        lowTail.next = highDummy.next;
        return lowDummy.next;
    }
}
