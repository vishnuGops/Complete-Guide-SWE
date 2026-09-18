import java.util.*;

class Solution {
    public int kthLargest(int[] readings, int k) {
        // A min-heap holding the k largest readings seen so far; its root is
        // therefore the k-th largest.
        PriorityQueue<Integer> heap = new PriorityQueue<>(k);
        for (int value : readings) {
            if (heap.size() < k) {
                heap.offer(value);
            } else if (value > heap.peek()) {
                heap.poll();
                heap.offer(value);
            }
        }
        return heap.peek();
    }
}
