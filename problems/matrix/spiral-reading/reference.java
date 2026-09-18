import java.util.*;

class Solution {
    public int[] readSpiral(int[][] grid) {
        int rows = grid.length;
        int columns = grid[0].length;
        int[] out = new int[rows * columns];
        int at = 0;

        int top = 0;
        int bottom = rows - 1;
        int left = 0;
        int right = columns - 1;

        while (top <= bottom && left <= right) {
            for (int column = left; column <= right; column++) {
                out[at++] = grid[top][column];
            }
            top++;

            for (int row = top; row <= bottom; row++) {
                out[at++] = grid[row][right];
            }
            right--;

            // A ring one row thick has already been read by the first run.
            if (top <= bottom) {
                for (int column = right; column >= left; column--) {
                    out[at++] = grid[bottom][column];
                }
                bottom--;
            }

            // A ring one column thick, likewise.
            if (left <= right) {
                for (int row = bottom; row >= top; row--) {
                    out[at++] = grid[row][left];
                }
                left++;
            }
        }

        return out;
    }
}
