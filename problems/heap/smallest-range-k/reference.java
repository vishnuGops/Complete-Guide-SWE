import java.util.*;

class Solution {
    public int[] narrowestRange(int[][] series) {
        // {value, which series, how far along}
        PriorityQueue<int[]> heap =
                new PriorityQueue<>((left, right) -> Integer.compare(left[0], right[0]));
        int high = Integer.MIN_VALUE;
        for (int which = 0; which < series.length; which++) {
            heap.offer(new int[] {series[which][0], which, 0});
            high = Math.max(high, series[which][0]);
        }

        int bestLow = heap.peek()[0];
        int bestHigh = high;

        while (true) {
            int[] entry = heap.poll();
            int low = entry[0];
            int which = entry[1];
            int at = entry[2];

            // Strictly narrower, so the first range of a given width wins.
            if (high - low < bestHigh - bestLow) {
                bestLow = low;
                bestHigh = high;
            }

            // That series has no readings left, so nothing further covers it.
            if (at + 1 == series[which].length) {
                break;
            }

            int following = series[which][at + 1];
            high = Math.max(high, following);
            heap.offer(new int[] {following, which, at + 1});
        }

        return new int[] {bestLow, bestHigh};
    }
}
