import java.util.*;

class Solution {
    public int[][] nearestPoints(int[][] points, int k) {
        // Nearest first, ties by x then y: the order the answer is in.
        Comparator<int[]> nearestFirst = (left, right) -> {
            long a = (long) left[0] * left[0] + (long) left[1] * left[1];
            long b = (long) right[0] * right[0] + (long) right[1] * right[1];
            if (a != b) {
                return Long.compare(a, b);
            }
            if (left[0] != right[0]) {
                return Integer.compare(left[0], right[0]);
            }
            return Integer.compare(left[1], right[1]);
        };

        // The heap of the k best gives up its worst, so it is ordered opposite.
        PriorityQueue<int[]> heap = new PriorityQueue<>(nearestFirst.reversed());
        for (int[] point : points) {
            if (heap.size() < k) {
                heap.offer(point);
            } else if (nearestFirst.compare(point, heap.peek()) < 0) {
                heap.poll();
                heap.offer(point);
            }
        }

        int[][] best = heap.toArray(new int[0][]);
        Arrays.sort(best, nearestFirst);
        return best;
    }
}
