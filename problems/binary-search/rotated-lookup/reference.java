import java.util.*;

class Solution {

    public int findRotated(int[] values, int target) {
        int low = 0;
        int high = values.length - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (values[mid] == target) {
                return mid;
            }
            if (values[low] <= values[mid]) {
                if (values[low] <= target && target < values[mid]) {
                    high = mid - 1;
                } else {
                    low = mid + 1;
                }
            } else {
                if (values[mid] < target && target <= values[high]) {
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }
        }
        return -1;
    }
}
