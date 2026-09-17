import java.util.*;

class Solution {

    public int firstNotBelow(int[] values, int threshold) {
        int low = 0;
        int high = values.length;
        while (low < high) {
            int mid = low + (high - low) / 2;
            if (values[mid] >= threshold) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return low;
    }
}
