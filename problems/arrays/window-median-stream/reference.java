import java.util.*;

class Solution {
    public double[] windowMedians(int[] readings, int k) {
        DualHeap window = new DualHeap(k);
        double[] out = new double[readings.length - k + 1];

        for (int index = 0; index < readings.length; index++) {
            window.insert(readings[index]);
            if (index >= k) {
                window.erase(readings[index - k]);
            }
            if (index >= k - 1) {
                out[index - k + 1] = window.median();
            }
        }
        return out;
    }

    /**
     * The window's readings split into a smaller half and a larger half, with
     * departed readings removed lazily: they stay in whichever heap holds them
     * until they reach the top, and the live counts are tracked separately.
     */
    private static final class DualHeap {
        private final PriorityQueue<Integer> small = new PriorityQueue<>(Comparator.reverseOrder());
        private final PriorityQueue<Integer> large = new PriorityQueue<>();
        private final Map<Integer, Integer> owed = new HashMap<>();
        private final int k;
        private int smallSize;
        private int largeSize;

        DualHeap(int k) {
            this.k = k;
        }

        private void prune(PriorityQueue<Integer> heap) {
            while (!heap.isEmpty()) {
                int value = heap.peek();
                Integer pending = owed.get(value);
                if (pending == null) {
                    return;
                }
                if (pending == 1) {
                    owed.remove(value);
                } else {
                    owed.put(value, pending - 1);
                }
                heap.poll();
            }
        }

        private void balance() {
            if (smallSize > largeSize + 1) {
                large.offer(small.poll());
                smallSize--;
                largeSize++;
                prune(small);
            } else if (smallSize < largeSize) {
                small.offer(large.poll());
                smallSize++;
                largeSize--;
                prune(large);
            }
        }

        void insert(int value) {
            if (small.isEmpty() || value <= small.peek()) {
                small.offer(value);
                smallSize++;
            } else {
                large.offer(value);
                largeSize++;
            }
            balance();
        }

        void erase(int value) {
            owed.merge(value, 1, Integer::sum);
            if (value <= small.peek()) {
                smallSize--;
                if (value == small.peek()) {
                    prune(small);
                }
            } else {
                largeSize--;
                if (value == large.peek()) {
                    prune(large);
                }
            }
            balance();
        }

        double median() {
            if (k % 2 == 1) {
                return small.peek();
            }
            return ((long) small.peek() + (long) large.peek()) / 2.0;
        }
    }
}
