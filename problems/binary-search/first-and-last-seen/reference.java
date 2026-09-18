import java.util.*;

class Solution {
    public int[] firstAndLast(int[] readings, int target) {
        int low = boundary(readings, target, false);
        int high = boundary(readings, target, true);
        if (low == high) {
            return new int[] {-1, -1};
        }
        return new int[] {low, high - 1};
    }

    /** First index where readings[i] >= target, or > target when inclusive. */
    private int boundary(int[] readings, int target, boolean inclusive) {
        int low = 0;
        int high = readings.length;
        while (low < high) {
            int mid = low + (high - low) / 2;
            boolean below = inclusive ? readings[mid] <= target : readings[mid] < target;
            if (below) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        return low;
    }
}
