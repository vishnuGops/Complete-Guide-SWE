import java.util.*;

class Solution {
    public int longestRising(int[] readings) {
        // tails[i] is the smallest value a run of length i + 1 can end with.
        int[] tails = new int[readings.length];
        int length = 0;

        for (int value : readings) {
            // The first entry not smaller than `value`: strictly increasing, so
            // an equal value replaces rather than extends.
            int low = 0;
            int high = length;
            while (low < high) {
                int mid = low + (high - low) / 2;
                if (tails[mid] < value) {
                    low = mid + 1;
                } else {
                    high = mid;
                }
            }
            tails[low] = value;
            if (low == length) {
                length++;
            }
        }

        return length;
    }
}
