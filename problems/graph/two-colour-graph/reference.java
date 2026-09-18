import java.util.*;

class Solution {
    public boolean twoColourable(int n, int[][] dislikes) {
        List<List<Integer>> against = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            against.add(new ArrayList<>());
        }
        for (int[] pair : dislikes) {
            against.get(pair[0]).add(pair[1]);
            against.get(pair[1]).add(pair[0]);
        }

        // 0 unassigned, 1 and -1 the two rooms.
        int[] room = new int[n];

        for (int start = 0; start < n; start++) {
            if (room[start] != 0) {
                continue;
            }
            room[start] = 1;
            Deque<Integer> queue = new ArrayDeque<>();
            queue.addLast(start);
            while (!queue.isEmpty()) {
                int person = queue.removeFirst();
                for (int other : against.get(person)) {
                    if (room[other] == 0) {
                        room[other] = -room[person];
                        queue.addLast(other);
                    } else if (room[other] == room[person]) {
                        return false;
                    }
                }
            }
        }

        return true;
    }
}
