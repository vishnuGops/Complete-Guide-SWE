import java.util.*;

class Solution {
    public ListNode foldChain(ListNode head) {
        if (head == null || head.next == null) {
            return head;
        }

        // The middle, cut so the first half is never the shorter one.
        ListNode slow = head;
        ListNode fast = head;
        while (fast.next != null && fast.next.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }

        ListNode second = slow.next;
        slow.next = null;

        // Reverse the second half.
        ListNode previous = null;
        while (second != null) {
            ListNode following = second.next;
            second.next = previous;
            previous = second;
            second = following;
        }

        // Weave the two halves together.
        ListNode first = head;
        second = previous;
        while (second != null) {
            ListNode afterFirst = first.next;
            ListNode afterSecond = second.next;
            first.next = second;
            second.next = afterFirst;
            first = afterFirst;
            second = afterSecond;
        }

        return head;
    }
}
