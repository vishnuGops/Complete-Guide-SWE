import java.util.*;

class Solution {
    public boolean readsSameBothWays(ListNode head) {
        // The middle, by the two-speed walk.
        ListNode slow = head;
        ListNode fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }

        ListNode second = reverse(slow);

        // Walk both halves inwards; the odd chain's middle link has no partner.
        boolean answer = true;
        ListNode left = head;
        ListNode right = second;
        while (right != null) {
            if (left.val != right.val) {
                answer = false;
                break;
            }
            left = left.next;
            right = right.next;
        }

        // Put the chain back the way it was handed over.
        reverse(second);
        return answer;
    }

    private ListNode reverse(ListNode head) {
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
