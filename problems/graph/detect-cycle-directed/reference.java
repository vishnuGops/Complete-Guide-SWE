import java.util.*;

class Solution {
    public boolean hasCycle(int n, int[][] roads) {
        List<List<Integer>> onwards = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            onwards.add(new ArrayList<>());
        }
        for (int[] road : roads) {
            onwards.get(road[0]).add(road[1]);
        }

        final int UNTOUCHED = 0;
        final int OPEN = 1;
        final int CLOSED = 2;
        int[] state = new int[n];

        for (int begin = 0; begin < n; begin++) {
            if (state[begin] != UNTOUCHED) {
                continue;
            }
            // Each place is pushed twice: once to enter it, once to leave it.
            Deque<int[]> stack = new ArrayDeque<>();
            stack.push(new int[] {begin, 0});
            while (!stack.isEmpty()) {
                int[] entry = stack.pop();
                int place = entry[0];
                if (entry[1] == 1) {
                    state[place] = CLOSED;
                    continue;
                }
                if (state[place] == OPEN) {
                    continue;
                }
                state[place] = OPEN;
                stack.push(new int[] {place, 1});
                for (int other : onwards.get(place)) {
                    if (state[other] == OPEN) {
                        return true;
                    }
                    if (state[other] == UNTOUCHED) {
                        stack.push(new int[] {other, 0});
                    }
                }
            }
        }

        return false;
    }
}
