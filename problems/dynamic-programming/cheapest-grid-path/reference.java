import java.util.*;

class Solution {
    public int cheapestAcross(int[][] tolls) {
        int rows = tolls.length;
        int columns = tolls[0].length;

        // One row of the table, updated in place.
        int[] cheapest = new int[columns];

        for (int row = 0; row < rows; row++) {
            for (int column = 0; column < columns; column++) {
                if (row == 0 && column == 0) {
                    cheapest[0] = tolls[0][0];
                } else if (row == 0) {
                    cheapest[column] = cheapest[column - 1] + tolls[row][column];
                } else if (column == 0) {
                    cheapest[column] = cheapest[column] + tolls[row][column];
                } else {
                    cheapest[column] =
                            Math.min(cheapest[column], cheapest[column - 1]) + tolls[row][column];
                }
            }
        }

        return cheapest[columns - 1];
    }
}
