import java.util.*;

class Solution {
    public int rotationPoint(int[] readings) {
        int low = 0;
        int high = readings.length - 1;

        // Invariant: the turning point is always inside [low, high].
        while (low < high) {
            int mid = low + (high - low) / 2;
            if (readings[mid] > readings[high]) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        return low;
    }
}
