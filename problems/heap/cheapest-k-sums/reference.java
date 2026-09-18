import java.util.*;

class Solution {
    public int[][] cheapestPairs(int[] first, int[] second, int k) {
        // {cost, row, column}, cheapest first, then by row and column.
        PriorityQueue<long[]> heap = new PriorityQueue<>((left, right) -> {
            if (left[0] != right[0]) {
                return Long.compare(left[0], right[0]);
            }
            if (left[1] != right[1]) {
                return Long.compare(left[1], right[1]);
            }
            return Long.compare(left[2], right[2]);
        });

        // Only the first k rows can contribute: row i is never cheaper than
        // row i - 1.
        int rows = Math.min(k, first.length);
        for (int i = 0; i < rows; i++) {
            heap.offer(new long[] {(long) first[i] + second[0], i, 0});
        }

        List<int[]> out = new ArrayList<>();
        while (!heap.isEmpty() && out.size() < k) {
            long[] entry = heap.poll();
            int i = (int) entry[1];
            int j = (int) entry[2];
            out.add(new int[] {first[i], second[j]});
            if (j + 1 < second.length) {
                heap.offer(new long[] {(long) first[i] + second[j + 1], i, j + 1});
            }
        }

        return out.toArray(new int[0][]);
    }
}
