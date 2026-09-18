import java.util.*;

class Solution {
    public void fillEnclosed(int[][] plan) {
        int rows = plan.length;
        int columns = plan[0].length;

        // Seed from every open cell on the edge.
        Deque<int[]> stack = new ArrayDeque<>();
        for (int row = 0; row < rows; row++) {
            for (int column : new int[] {0, columns - 1}) {
                if (plan[row][column] == 0) {
                    plan[row][column] = 2;
                    stack.push(new int[] {row, column});
                }
            }
        }
        for (int column = 0; column < columns; column++) {
            for (int row : new int[] {0, rows - 1}) {
                if (plan[row][column] == 0) {
                    plan[row][column] = 2;
                    stack.push(new int[] {row, column});
                }
            }
        }

        int[] rowStep = {-1, 1, 0, 0};
        int[] columnStep = {0, 0, -1, 1};

        // An explicit stack: an all-open plan is one region of ten thousand.
        while (!stack.isEmpty()) {
            int[] at = stack.pop();
            for (int step = 0; step < 4; step++) {
                int nextRow = at[0] + rowStep[step];
                int nextColumn = at[1] + columnStep[step];
                if (nextRow >= 0 && nextRow < rows && nextColumn >= 0 && nextColumn < columns
                        && plan[nextRow][nextColumn] == 0) {
                    plan[nextRow][nextColumn] = 2;
                    stack.push(new int[] {nextRow, nextColumn});
                }
            }
        }

        // Unreached open cells are enclosed; reached ones go back to open.
        for (int row = 0; row < rows; row++) {
            for (int column = 0; column < columns; column++) {
                if (plan[row][column] == 0) {
                    plan[row][column] = 1;
                } else if (plan[row][column] == 2) {
                    plan[row][column] = 0;
                }
            }
        }
    }
}
