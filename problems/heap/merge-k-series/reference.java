import java.util.*;

class Solution {
    public int[] mergeSeries(int[][] series) {
        // {value, which series, how far along}
        PriorityQueue<int[]> heap =
                new PriorityQueue<>((left, right) -> Integer.compare(left[0], right[0]));
        int total = 0;
        for (int which = 0; which < series.length; which++) {
            total += series[which].length;
            if (series[which].length > 0) {
                heap.offer(new int[] {series[which][0], which, 0});
            }
        }

        int[] out = new int[total];
        int at = 0;
        while (!heap.isEmpty()) {
            int[] entry = heap.poll();
            out[at++] = entry[0];
            int which = entry[1];
            int next = entry[2] + 1;
            if (next < series[which].length) {
                heap.offer(new int[] {series[which][next], which, next});
            }
        }

        return out;
    }
}
