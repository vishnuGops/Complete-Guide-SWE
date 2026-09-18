import java.util.*;

class Solution {
    public int pathsAcross(int[][] grid) {
        int rows = grid.length;
        int columns = grid[0].length;

        // One row of the table, updated in place: a cell needs only the value
        // above it (still in the array) and to its left (already updated).
        int[] routes = new int[columns];
        routes[0] = 1;

        for (int row = 0; row < rows; row++) {
            for (int column = 0; column < columns; column++) {
                if (grid[row][column] == 1) {
                    routes[column] = 0;
                } else if (column > 0) {
                    routes[column] += routes[column - 1];
                }
            }
        }

        return routes[columns - 1];
    }
}
