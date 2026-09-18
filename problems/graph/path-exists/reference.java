import java.util.*;

class Solution {
    public boolean canReach(int n, int[][] roads, int start, int finish) {
        if (start == finish) {
            return true;
        }

        List<List<Integer>> neighbours = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            neighbours.add(new ArrayList<>());
        }
        for (int[] road : roads) {
            neighbours.get(road[0]).add(road[1]);
            neighbours.get(road[1]).add(road[0]);
        }

        boolean[] seen = new boolean[n];
        seen[start] = true;
        Deque<Integer> stack = new ArrayDeque<>();
        stack.push(start);

        while (!stack.isEmpty()) {
            int place = stack.pop();
            for (int other : neighbours.get(place)) {
                if (other == finish) {
                    return true;
                }
                if (!seen[other]) {
                    // Marked when pushed, so a place is walked once.
                    seen[other] = true;
                    stack.push(other);
                }
            }
        }

        return false;
    }
}
