import java.util.*;

class Solution {
    public void turnGrid(int[][] grid) {
        int n = grid.length;

        // Reflect in the main diagonal. Only above it, or every swap is undone.
        for (int row = 0; row < n; row++) {
            for (int column = row + 1; column < n; column++) {
                int carried = grid[row][column];
                grid[row][column] = grid[column][row];
                grid[column][row] = carried;
            }
        }

        // Reflect left to right.
        for (int row = 0; row < n; row++) {
            int left = 0;
            int right = n - 1;
            while (left < right) {
                int carried = grid[row][left];
                grid[row][left] = grid[row][right];
                grid[row][right] = carried;
                left++;
                right--;
            }
        }
    }
}
