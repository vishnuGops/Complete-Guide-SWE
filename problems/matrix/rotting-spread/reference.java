import java.util.*;

class Solution {
    public int minutesUntilSpoiled(int[][] crate) {
        int rows = crate.length;
        int columns = crate[0].length;

        Deque<int[]> queue = new ArrayDeque<>();
        int fresh = 0;
        for (int row = 0; row < rows; row++) {
            for (int column = 0; column < columns; column++) {
                if (crate[row][column] == 2) {
                    queue.addLast(new int[] {row, column});
                } else if (crate[row][column] == 1) {
                    fresh++;
                }
            }
        }

        int[] rowStep = {-1, 1, 0, 0};
        int[] columnStep = {0, 0, -1, 1};
        int minutes = 0;

        while (!queue.isEmpty() && fresh > 0) {
            // Exactly the cells spoiled so far: one whole minute.
            int level = queue.size();
            for (int i = 0; i < level; i++) {
                int[] at = queue.removeFirst();
                for (int step = 0; step < 4; step++) {
                    int nextRow = at[0] + rowStep[step];
                    int nextColumn = at[1] + columnStep[step];
                    if (nextRow >= 0 && nextRow < rows && nextColumn >= 0 && nextColumn < columns
                            && crate[nextRow][nextColumn] == 1) {
                        crate[nextRow][nextColumn] = 2;
                        fresh--;
                        queue.addLast(new int[] {nextRow, nextColumn});
                    }
                }
            }
            minutes++;
        }

        return fresh == 0 ? minutes : -1;
    }
}
