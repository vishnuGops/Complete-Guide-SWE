import java.util.*;

class Solution {
    public boolean gridContains(int[][] grid, int target) {
        int rows = grid.length;
        int columns = grid[0].length;

        int low = 0;
        int high = rows * columns - 1;

        while (low <= high) {
            int mid = low + (high - low) / 2;
            int value = grid[mid / columns][mid % columns];
            if (value == target) {
                return true;
            }
            if (value < target) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return false;
    }
}
