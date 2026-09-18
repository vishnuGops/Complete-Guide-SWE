import java.util.*;

class Solution {
    public int[] mostCommon(int[] readings, int k) {
        Map<Integer, Integer> counts = new HashMap<>();
        for (int value : readings) {
            counts.merge(value, 1, Integer::sum);
        }

        // A min-heap of the k best entries so far, ordered by the rule
        // reversed: the weakest entry is the one to drop.
        Comparator<int[]> weakestFirst = (left, right) ->
                left[1] != right[1] ? Integer.compare(left[1], right[1])
                                    : Integer.compare(right[0], left[0]);
        PriorityQueue<int[]> heap = new PriorityQueue<>(weakestFirst);

        for (Map.Entry<Integer, Integer> entry : counts.entrySet()) {
            int[] candidate = {entry.getKey(), entry.getValue()};
            if (heap.size() < k) {
                heap.offer(candidate);
            } else if (weakestFirst.compare(candidate, heap.peek()) > 0) {
                heap.poll();
                heap.offer(candidate);
            }
        }

        int[][] best = heap.toArray(new int[0][]);
        Arrays.sort(best, (left, right) ->
                left[1] != right[1] ? Integer.compare(right[1], left[1])
                                    : Integer.compare(left[0], right[0]));

        int[] out = new int[best.length];
        for (int i = 0; i < out.length; i++) {
            out[i] = best[i][0];
        }
        return out;
    }
}
