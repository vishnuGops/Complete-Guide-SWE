import java.util.*;

class Solution {
    public int countIslands(int[][] terrain) {
        int rows = terrain.length;
        int columns = terrain[0].length;
        int islands = 0;

        int[] rowStep = {-1, 1, 0, 0};
        int[] columnStep = {0, 0, -1, 1};

        for (int startRow = 0; startRow < rows; startRow++) {
            for (int startColumn = 0; startColumn < columns; startColumn++) {
                if (terrain[startRow][startColumn] != 1) {
                    continue;
                }

                islands++;
                // An explicit stack: a recursive fill would be ten thousand
                // frames deep on a full grid.
                Deque<int[]> stack = new ArrayDeque<>();
                stack.push(new int[] {startRow, startColumn});
                terrain[startRow][startColumn] = 0;

                while (!stack.isEmpty()) {
                    int[] at = stack.pop();
                    for (int step = 0; step < 4; step++) {
                        int nextRow = at[0] + rowStep[step];
                        int nextColumn = at[1] + columnStep[step];
                        if (nextRow >= 0 && nextRow < rows
                                && nextColumn >= 0 && nextColumn < columns
                                && terrain[nextRow][nextColumn] == 1) {
                            // Marked when pushed, not when popped.
                            terrain[nextRow][nextColumn] = 0;
                            stack.push(new int[] {nextRow, nextColumn});
                        }
                    }
                }
            }
        }

        return islands;
    }
}
