import java.util.*;

class Solution {
    public int fewestSteps(int[][] plan) {
        int rows = plan.length;
        int columns = plan[0].length;

        if (plan[0][0] != 0 || plan[rows - 1][columns - 1] != 0) {
            return -1;
        }

        boolean[][] visited = new boolean[rows][columns];
        visited[0][0] = true;
        Deque<int[]> queue = new ArrayDeque<>();
        queue.addLast(new int[] {0, 0, 1});

        int[] rowStep = {-1, 1, 0, 0};
        int[] columnStep = {0, 0, -1, 1};

        while (!queue.isEmpty()) {
            int[] at = queue.removeFirst();
            if (at[0] == rows - 1 && at[1] == columns - 1) {
                return at[2];
            }

            for (int step = 0; step < 4; step++) {
                int nextRow = at[0] + rowStep[step];
                int nextColumn = at[1] + columnStep[step];
                if (nextRow >= 0 && nextRow < rows && nextColumn >= 0 && nextColumn < columns
                        && plan[nextRow][nextColumn] == 0 && !visited[nextRow][nextColumn]) {
                    // Marked when pushed, so a cell is queued once.
                    visited[nextRow][nextColumn] = true;
                    queue.addLast(new int[] {nextRow, nextColumn, at[2] + 1});
                }
            }
        }

        return -1;
    }
}
