import java.util.*;

class Solution {
    public int[] windowMaxima(int[] readings, int k) {
        int n = readings.length;
        int[] out = new int[n - k + 1];
        // Positions of the readings that are still candidates, decreasing.
        Deque<Integer> candidates = new ArrayDeque<>();

        for (int at = 0; at < n; at++) {
            // Evicted by value: something larger arrived after them.
            while (!candidates.isEmpty() && readings[candidates.peekLast()] <= readings[at]) {
                candidates.removeLast();
            }
            candidates.addLast(at);

            // Evicted by age: fallen out of the window.
            if (candidates.peekFirst() <= at - k) {
                candidates.removeFirst();
            }

            if (at >= k - 1) {
                out[at - k + 1] = readings[candidates.peekFirst()];
            }
        }

        return out;
    }
}
