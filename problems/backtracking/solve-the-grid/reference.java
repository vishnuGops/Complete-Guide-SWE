import java.util.*;

class Solution {

    private int[][] grid;
    private final int[] rowUsed = new int[9];
    private final int[] columnUsed = new int[9];
    private final int[] boxUsed = new int[9];
    private final List<int[]> blanks = new ArrayList<>();

    public void fillGrid(int[][] grid) {
        this.grid = grid;
        for (int row = 0; row < 9; row++) {
            for (int column = 0; column < 9; column++) {
                int digit = grid[row][column];
                if (digit == 0) {
                    blanks.add(new int[] {row, column});
                } else {
                    int bit = 1 << digit;
                    rowUsed[row] |= bit;
                    columnUsed[column] |= bit;
                    boxUsed[(row / 3) * 3 + column / 3] |= bit;
                }
            }
        }
        solve(0);
    }

    private boolean solve(int at) {
        if (at == blanks.size()) {
            return true;
        }
        int row = blanks.get(at)[0];
        int column = blanks.get(at)[1];
        int box = (row / 3) * 3 + column / 3;

        for (int digit = 1; digit <= 9; digit++) {
            int bit = 1 << digit;
            // Legal here, checked before writing.
            if (((rowUsed[row] | columnUsed[column] | boxUsed[box]) & bit) != 0) {
                continue;
            }
            grid[row][column] = digit;
            rowUsed[row] |= bit;
            columnUsed[column] |= bit;
            boxUsed[box] |= bit;

            if (solve(at + 1)) {
                return true;
            }

            grid[row][column] = 0;
            rowUsed[row] &= ~bit;
            columnUsed[column] &= ~bit;
            boxUsed[box] &= ~bit;
        }
        return false;
    }
}
