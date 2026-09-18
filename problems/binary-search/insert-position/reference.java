import java.util.*;

class Solution {
    public int insertPosition(int[] readings, int target) {
        int low = 0;
        int high = readings.length;

        while (low < high) {
            int mid = low + (high - low) / 2;
            if (readings[mid] < target) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        return low;
    }
}
