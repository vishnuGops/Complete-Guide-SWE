import java.util.*;

class Solution {
    public int wholeRoot(int value) {
        int low = 0;
        int high = 46340; // 46341 * 46341 exceeds the largest allowed value

        while (low < high) {
            // Rounded up: this loop keeps `mid` when it fits.
            int mid = low + (high - low + 1) / 2;
            if ((long) mid * mid <= value) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }

        return low;
    }
}
