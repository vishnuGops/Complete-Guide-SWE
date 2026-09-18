import java.util.*;

class MedianStream {

    /** The smaller half, largest first. */
    private final PriorityQueue<Integer> small = new PriorityQueue<>(Comparator.reverseOrder());
    /** The larger half, smallest first. */
    private final PriorityQueue<Integer> large = new PriorityQueue<>();

    MedianStream() {
    }

    public double add(int value) {
        if (small.isEmpty() || value <= small.peek()) {
            small.offer(value);
        } else {
            large.offer(value);
        }

        // Keep the halves within one of each other.
        if (small.size() > large.size() + 1) {
            large.offer(small.poll());
        } else if (large.size() > small.size()) {
            small.offer(large.poll());
        }

        if (small.size() > large.size()) {
            return small.peek();
        }
        // Widened: two readings near 10^9 sum past a 32-bit int.
        return ((long) small.peek() + (long) large.peek()) / 2.0;
    }
}
