import java.util.*;

class Solution {
    public int cheapestRoute(int n, int[][] roads, int start, int finish) {
        List<List<int[]>> onwards = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            onwards.add(new ArrayList<>());
        }
        for (int[] road : roads) {
            onwards.get(road[0]).add(new int[] {road[1], road[2]});
        }

        boolean[] settled = new boolean[n];
        PriorityQueue<int[]> heap =
                new PriorityQueue<>((left, right) -> Integer.compare(left[0], right[0]));
        heap.offer(new int[] {0, start});

        while (!heap.isEmpty()) {
            int[] entry = heap.poll();
            int paid = entry[0];
            int place = entry[1];
            // A stale entry: a cheaper route to this place was found later.
            if (settled[place]) {
                continue;
            }
            settled[place] = true;
            if (place == finish) {
                return paid;
            }
            for (int[] road : onwards.get(place)) {
                if (!settled[road[0]]) {
                    heap.offer(new int[] {paid + road[1], road[0]});
                }
            }
        }

        return -1;
    }
}
