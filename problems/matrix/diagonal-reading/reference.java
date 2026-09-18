import java.util.*;

class Solution {
    public int[] readDiagonals(int[][] grid) {
        int rows = grid.length;
        int columns = grid[0].length;
        int[] out = new int[rows * columns];
        int at = 0;

        for (int total = 0; total <= rows + columns - 2; total++) {
            // column = total - row has to stay on the grid too.
            int first = Math.max(0, total - columns + 1);
            int last = Math.min(total, rows - 1);
            for (int row = first; row <= last; row++) {
                out[at++] = grid[row][total - row];
            }
        }

        return out;
    }
}
