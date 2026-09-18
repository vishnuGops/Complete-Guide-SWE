import java.util.*;

class Solution {
    public ListNode mergeAll(ListNode[] chains) {
        PriorityQueue<ListNode> heap =
                new PriorityQueue<>((left, right) -> Integer.compare(left.val, right.val));
        for (ListNode head : chains) {
            if (head != null) {
                heap.offer(head);
            }
        }

        ListNode dummy = new ListNode();
        ListNode tail = dummy;

        while (!heap.isEmpty()) {
            ListNode node = heap.poll();
            tail.next = node;
            tail = node;
            if (node.next != null) {
                heap.offer(node.next);
            }
        }

        tail.next = null;
        return dummy.next;
    }
}
