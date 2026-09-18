import java.util.*;

class Solution {
    public int[] courseOrder(int n, int[][] rules) {
        List<List<Integer>> unlocks = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            unlocks.add(new ArrayList<>());
        }
        int[] waiting = new int[n];
        for (int[] rule : rules) {
            unlocks.get(rule[0]).add(rule[1]);
            waiting[rule[1]]++;
        }

        // A heap, not a queue: the answer must be the smallest valid order.
        PriorityQueue<Integer> available = new PriorityQueue<>();
        for (int course = 0; course < n; course++) {
            if (waiting[course] == 0) {
                available.offer(course);
            }
        }

        int[] order = new int[n];
        int taken = 0;
        while (!available.isEmpty()) {
            int course = available.poll();
            order[taken++] = course;
            for (int unlocked : unlocks.get(course)) {
                if (--waiting[unlocked] == 0) {
                    available.offer(unlocked);
                }
            }
        }

        // Anything left still waits on something, which means a cycle.
        return taken == n ? order : new int[0];
    }
}
