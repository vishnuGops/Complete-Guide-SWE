import java.util.*;

class RunningKthLargest {

    private final int k;
    // A min-heap of the k largest readings; its root is the answer.
    private final PriorityQueue<Integer> heap = new PriorityQueue<>();

    RunningKthLargest(int k, int[] first) {
        this.k = k;
        for (int value : first) {
            push(value);
        }
    }

    public int add(int value) {
        push(value);
        return heap.peek();
    }

    private void push(int value) {
        if (heap.size() < k) {
            heap.offer(value);
        } else if (value > heap.peek()) {
            heap.poll();
            heap.offer(value);
        }
    }
}
