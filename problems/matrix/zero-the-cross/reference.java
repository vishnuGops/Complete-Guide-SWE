import java.util.*;

class Solution {
    public void blankTheCross(int[][] grid) {
        int rows = grid.length;
        int columns = grid[0].length;

        // grid[0][0] cannot mean both "blank row 0" and "blank column 0", so
        // the first column gets its own flag.
        boolean firstColumnBlank = false;
        for (int row = 0; row < rows; row++) {
            if (grid[row][0] == 0) {
                firstColumnBlank = true;
            }
        }

        for (int row = 0; row < rows; row++) {
            for (int column = 1; column < columns; column++) {
                if (grid[row][column] == 0) {
                    grid[row][0] = 0;
                    grid[0][column] = 0;
                }
            }
        }

        // The interior first: the marks live in row 0 and column 0.
        for (int row = 1; row < rows; row++) {
            for (int column = 1; column < columns; column++) {
                if (grid[row][0] == 0 || grid[0][column] == 0) {
                    grid[row][column] = 0;
                }
            }
        }

        if (grid[0][0] == 0) {
            Arrays.fill(grid[0], 0);
        }

        if (firstColumnBlank) {
            for (int row = 0; row < rows; row++) {
                grid[row][0] = 0;
            }
        }
    }
}
