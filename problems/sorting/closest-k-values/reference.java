import java.util.*;

class Solution {
    public int[] closestReadings(int[] readings, int k, int target) {
        int low = 0;
        int high = readings.length - k;

        while (low < high) {
            int mid = low + (high - low) / 2;
            // Is the reading being dropped further away than the one gained?
            // Widened to long: the differences can exceed a 32-bit int.
            if ((long) target - readings[mid] > (long) readings[mid + k] - target) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        return Arrays.copyOfRange(readings, low, low + k);
    }
}
