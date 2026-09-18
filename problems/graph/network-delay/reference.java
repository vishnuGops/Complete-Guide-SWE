import java.util.*;

class Solution {
    public int whenAllHear(int n, int[][] links, int source) {
        List<List<int[]>> onwards = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            onwards.add(new ArrayList<>());
        }
        for (int[] link : links) {
            onwards.get(link[0]).add(new int[] {link[1], link[2]});
        }

        boolean[] settled = new boolean[n];
        int remaining = n;
        int last = 0;
        PriorityQueue<int[]> heap =
                new PriorityQueue<>((left, right) -> Integer.compare(left[0], right[0]));
        heap.offer(new int[] {0, source});

        while (!heap.isEmpty() && remaining > 0) {
            int[] entry = heap.poll();
            int tick = entry[0];
            int machine = entry[1];
            if (settled[machine]) {
                continue;
            }
            settled[machine] = true;
            remaining--;
            last = Math.max(last, tick);
            for (int[] link : onwards.get(machine)) {
                if (!settled[link[0]]) {
                    heap.offer(new int[] {tick + link[1], link[0]});
                }
            }
        }

        return remaining == 0 ? last : -1;
    }
}
