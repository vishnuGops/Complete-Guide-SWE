import java.util.*;

class Solution {
    public int countGroups(int n, int[][] links) {
        // The edge list cannot answer "who is next to this person"; this can.
        List<List<Integer>> neighbours = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            neighbours.add(new ArrayList<>());
        }
        for (int[] link : links) {
            neighbours.get(link[0]).add(link[1]);
            neighbours.get(link[1]).add(link[0]);
        }

        boolean[] seen = new boolean[n];
        int groups = 0;

        for (int start = 0; start < n; start++) {
            if (seen[start]) {
                continue;
            }
            groups++;
            // An explicit stack: a chain of ten thousand is one component.
            Deque<Integer> stack = new ArrayDeque<>();
            stack.push(start);
            seen[start] = true;
            while (!stack.isEmpty()) {
                int person = stack.pop();
                for (int other : neighbours.get(person)) {
                    if (!seen[other]) {
                        seen[other] = true;
                        stack.push(other);
                    }
                }
            }
        }

        return groups;
    }
}
